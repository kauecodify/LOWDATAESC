import { Anchor, AnchorBackend } from './anchor';
import { AuditChain } from './audit-chain';
import { DustLedger, DustPolicy } from './dust';
import { InvariantId, InvariantContext, assertAll, checkAll, InvariantViolation } from './invariants';
import { buildKey, IdempotencyStore, withIdempotency } from './idempotency';
import {
  AmortizationDep, buildSplitAmortSaga, EscrowDep, InsufficientStock, SplitAmortCtx, SplitDep
} from './saga';
import { Cents, InvalidBpsSum, MicroFraction, NonIntegerCents, NonIntegerMicro, assertCents } from './money';

export enum EngineCode {
  OK = 'OK',
  BLOCKED_WHITELABEL = 'BLOCKED_WHITELABEL',
  ABORTED_ZERO_TRUST = 'ABORTED_ZERO_TRUST',
  ESCROW_PRECISION = 'ESCROW_PRECISION',
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  AUDIT_CHAIN_BROKEN = 'AUDIT_CHAIN_BROKEN',
  DUST_INSUFFICIENT = 'DUST_INSUFFICIENT',
  INVARIANT_VIOLATION = 'INVARIANT_VIOLATION',
  IDEMPOTENT_REPLAY = 'IDEMPOTENT_REPLAY',
  UNANCHORED_CHAIN = 'UNANCHORED_CHAIN',
  NON_INTEGER_CENTS = 'NON_INTEGER_CENTS',
  NON_INTEGER_MICRO = 'NON_INTEGER_MICRO',
  NEGATIVE_BALANCE = 'NEGATIVE_BALANCE',
  INVALID_BPS_SUM = 'INVALID_BPS_SUM',
  SAGA_STEP_FAILED = 'SAGA_STEP_FAILED'
}

export class WhitelistRejected extends Error {
  constructor(message: string) {
    super('WHITELIST_DENIED: ' + message);
    this.name = 'WhitelistRejected';
  }
}

export interface OperationRequest {
  tenant: string;
  operation: string;
  isin: string;
  amountCents: Cents;
  txId: string;
  nonce: string;
  zeroTrust: { deviceSig: string; kycToken: string; antifraudScore: number };
}

export interface OperationResult {
  ok: boolean;
  code: EngineCode;
  txId: string;
  seal?: { recordHash: string; prevHash: string; sequence: number };
  buckets?: Cents[];
  fraction?: MicroFraction;
  dustApplied?: Cents;
  violations?: InvariantId[];
}

export interface WhitelabelDep {
  assertOperationAllowed(tenant: string, operation: string): void;
  assertBondAllowed(tenant: string, isin: string): void;
}

export interface ZeroTrustDep {
  verify(ctx: { deviceSig: string; kycToken: string; antifraudScore: number; tenant: string }): void;
}

export interface EngineDeps {
  whitelabel: WhitelabelDep;
  zeroTrust: ZeroTrustDep;
  split: SplitDep;
  escrow: EscrowDep;
  amort: AmortizationDep;
  dust: DustLedger;
  audit: AuditChain;
  idem: IdempotencyStore;
  anchor: AnchorBackend;
  policy: DustPolicy;
  clock: () => string;
  bps?: readonly number[];
  minAntifraudScore?: number;
}

export const ESCROW_AMORT_ACCOUNT = 'FUNDO_AMORTIZACAO_DIVIDA';
export const DEFAULT_BPS: readonly number[] = [7500, 1700, 750, 50];

// INVARIANTE I4/I7: contexto montado a partir do estado pós-saga
function invariantContextOf(ctx: SplitAmortCtx, deps: EngineDeps): InvariantContext {
  return {
    bruto: ctx.grossCents,
    buckets: ctx.buckets,
    bucketAmort: ctx.amortBucket,
    puCents: deps.amort.pu(ctx.isin),
    policy: deps.policy,
    fracaoMicro: ctx.fractionMicro,
    estoqueMicro: ctx.stockMicroBefore,
    escrowAfter: ctx.escrowAfter,
    dustApplied: ctx.dustApplied,
    amortizadoCents: ctx.consumedCents,
    pagoAmortCents: ctx.amortBucket,
    auditChainVerifies: function () { return deps.audit.auditChainVerifies(); }
  };
}

export class DebtControlEngine {
  private readonly deps: EngineDeps;

  constructor(deps: EngineDeps) {
    this.deps = deps;
  }

  private codeFromError(err: Error): EngineCode {
    if (err instanceof WhitelistRejected) return EngineCode.BLOCKED_WHITELABEL;
    if (err.name === 'ZeroTrustError') return EngineCode.ABORTED_ZERO_TRUST;
    if (err instanceof InsufficientStock) return EngineCode.INSUFFICIENT_STOCK;
    if (err.name === 'InsufficientDust') return EngineCode.DUST_INSUFFICIENT;
    if (err instanceof InvariantViolation) return EngineCode.INVARIANT_VIOLATION;
    if (err instanceof NonIntegerCents) return EngineCode.NON_INTEGER_CENTS;
    if (err instanceof NonIntegerMicro) return EngineCode.NON_INTEGER_MICRO;
    if (err.name === 'NegativeBalance') return EngineCode.NEGATIVE_BALANCE;
    if (err instanceof InvalidBpsSum) return EngineCode.INVALID_BPS_SUM;
    return EngineCode.SAGA_STEP_FAILED;
  }

  private async pipeline(req: OperationRequest): Promise<OperationResult> {
    const deps = this.deps;
    const minScore = deps.minAntifraudScore === undefined ? 90 : deps.minAntifraudScore;
    void minScore;

    if (!Number.isInteger(req.amountCents) || req.amountCents < 0) {
      deps.audit.appendRejection({ txId: req.txId, code: EngineCode.NON_INTEGER_CENTS, reason: 'valor bruto invalido' });
      return { ok: false, code: EngineCode.NON_INTEGER_CENTS, txId: req.txId };
    }

    try {
      deps.whitelabel.assertOperationAllowed(req.tenant, req.operation);
      deps.whitelabel.assertBondAllowed(req.tenant, req.isin);
      deps.zeroTrust.verify({
        deviceSig: req.zeroTrust.deviceSig,
        kycToken: req.zeroTrust.kycToken,
        antifraudScore: req.zeroTrust.antifraudScore,
        tenant: req.tenant
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      deps.audit.appendRejection({ txId: req.txId, code: this.codeFromError(error), reason: error.message });
      return { ok: false, code: this.codeFromError(error), txId: req.txId };
    }

    const initialCtx: SplitAmortCtx = {
      txId: req.txId,
      tenant: req.tenant,
      isin: req.isin,
      operation: req.operation,
      grossCents: assertCents(req.amountCents),
      bps: deps.bps || DEFAULT_BPS,
      escrowAccount: ESCROW_AMORT_ACCOUNT,
      policy: deps.policy,
      puCents: deps.amort.pu(req.isin),
      buckets: [],
      amortBucket: 0 as Cents,
      escrowAfter: 0 as Cents,
      fractionMicro: 0 as MicroFraction,
      stockMicroBefore: 0,
      stockMicroAfter: 0,
      consumedCents: 0 as Cents,
      residualCents: 0 as Cents,
      dustApplied: 0 as Cents,
      seal: null
    };

    const saga = buildSplitAmortSaga({
      split: deps.split,
      escrow: deps.escrow,
      amort: deps.amort,
      audit: deps.audit,
      dust: deps.dust
    });

    const outcome = await saga.run(initialCtx);
    if (!outcome.ok) {
      const failure = outcome.errors[0];
      deps.audit.appendRejection({
        txId: req.txId,
        code: this.codeFromError(failure),
        reason: 'saga.falha_em=' + outcome.failedAt + ';compensacoes=' + String(outcome.pending.length),
        payload: { failedAt: outcome.failedAt }
      });
      return { ok: false, code: this.codeFromError(failure), txId: req.txId };
    }

    const ctx = outcome.ctx;
    try {
      assertAll(invariantContextOf(ctx, deps));
    } catch (err) {
      if (err instanceof InvariantViolation) {
        deps.audit.appendRejection({ txId: req.txId, code: EngineCode.INVARIANT_VIOLATION, reason: err.id });
        return {
          ok: false,
          code: EngineCode.INVARIANT_VIOLATION,
          txId: req.txId,
          violations: checkAll(invariantContextOf(ctx, deps)).filter(function (r) { return !r.ok; }).map(function (r) { return r.id; })
        };
      }
      throw err;
    }

    const seal = ctx.seal || { prevHash: '', recordHash: '', sequence: 0 };
    return {
      ok: true,
      code: EngineCode.OK,
      txId: req.txId,
      seal: { recordHash: seal.recordHash, prevHash: seal.prevHash, sequence: seal.sequence },
      buckets: ctx.buckets,
      fraction: ctx.fractionMicro,
      dustApplied: ctx.dustApplied
    };
  }

  async anchorChainHead(): Promise<Anchor> {
    const head = this.deps.audit.head();
    return this.deps.anchor.publish({ hash: head.hash, index: head.index });
  }

  // GARANTIA: execução com mesma (tenant,txId,nonce) retorna o MESMO resultado,
  // sem efeitos novos. Replay explícito devolve IDEMPOTENT_REPLAY.
  async execute(req: OperationRequest): Promise<OperationResult> {
    const deps = this.deps;
    const engine = this;
    const key = buildKey({
      tenant: req.tenant,
      txId: req.txId,
      nonce: req.nonce,
      payload: { operation: req.operation, isin: req.isin, amountCents: req.amountCents },
      canonical: function (v) { return JSON.stringify(v); }
    });
    const existing = deps.idem.get(key, deps.clock());
    if (existing) {
      const cached = existing.result as OperationResult;
      const replayResult: OperationResult = { ...cached, code: EngineCode.IDEMPOTENT_REPLAY };
      return replayResult;
    }
    return withIdempotency(deps.idem, key, function () {
      return engine.pipeline(req);
    });
  }
}
