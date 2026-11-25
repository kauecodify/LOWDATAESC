import { Cents, MicroFraction } from './money';
import { DustPolicy, DustReason } from './dust';

export interface SplitDep {
  splitByBps(total: Cents, bps: readonly number[]): Cents[];
}

export interface EscrowDep {
  credit(account: string, amountCents: Cents): Cents;
  debit(account: string, amountCents: Cents): Cents;
  balance(account: string): Cents;
}

export interface FractionPurchase {
  fractionMicro: MicroFraction;
  consumedCents: Cents;
  residualCents: Cents;
}

export class InsufficientStock extends Error {
  readonly isin: string;
  constructor(isin: string) {
    super('INSUFFICIENT_STOCK: estoque insuficiente para baixa em ' + isin);
    this.name = 'InsufficientStock';
    this.isin = isin;
  }
}

export interface AmortizationDep {
  pu(isin: string): number;
  stock(isin: string): number;
  purchase(isin: string, amountCents: Cents): FractionPurchase;
  rollback(isin: string, fractionMicro: MicroFraction): void;
}

export interface AppendOutcomeLike {
  prevHash: string;
  recordHash: string;
  sequence: number;
}

export interface AuditDep {
  append(event: string, payload: Record<string, unknown>, txId: string | null): AppendOutcomeLike;
  appendCompensation(info: { txId: string; steps: string[] }): void;
}

export interface DustDep {
  credit(input: { tenant: string; isin: string; reason: DustReason; amountCents: Cents; refTxId: string | null }): { id: string; amountCents: Cents };
  debit(isin: string, amountCents: Cents, reason: DustReason, refTxId?: string, tenant?: string): unknown;
}

export interface SplitAmortCtx {
  txId: string;
  tenant: string;
  isin: string;
  operation: string;
  grossCents: Cents;
  bps: readonly number[];
  escrowAccount: string;
  policy: DustPolicy;
  puCents: number;
  buckets: Cents[];
  amortBucket: Cents;
  escrowAfter: Cents;
  fractionMicro: MicroFraction;
  stockMicroBefore: number;
  stockMicroAfter: number;
  consumedCents: Cents;
  residualCents: Cents;
  dustApplied: Cents;
  seal: { prevHash: string; recordHash: string; sequence: number } | null;
}

export interface SagaStep<C> {
  name: string;
  do(ctx: C): Promise<void>;
  undo(ctx: C): Promise<void>;
}

export interface JournalEntry {
  txId: string;
  step: string;
  phase: 'DO' | 'UNDO' | 'OK' | 'FAIL';
  at: string;
}

export interface Journal {
  append(entry: JournalEntry): void;
  pending(txId: string): readonly JournalEntry[];
}

// Durável em memória para POC; a interface Journal permanece para backend persistente.
export class InMemoryJournal implements Journal {
  private readonly entries: JournalEntry[] = [];

  append(entry: JournalEntry): void {
    this.entries.push(entry);
  }

  pending(txId: string): readonly JournalEntry[] {
    return this.entries.filter(function (e) {
      return e.txId === txId && (e.phase === 'FAIL' || e.phase === 'UNDO');
    });
  }

  all(txId?: string): readonly JournalEntry[] {
    if (txId === undefined) return this.entries.slice();
    return this.entries.filter(function (e) { return e.txId === txId; });
  }
}

export type SagaOutcome<C> =
  | { ok: true; ctx: C }
  | { ok: false; failedAt: string; ctx: C; errors: Error[]; pending: readonly JournalEntry[] };

// Saga com compensações explícitas: se um passo falha, os passos concluídos
// sofrem undo em ordem inversa. Nenhum estado órfão silencioso: ou o estado
// volta ao inicial, ou existe pendência explícita no journal.
export class Saga<C> {
  private readonly steps: readonly SagaStep<C>[];
  private readonly journal: Journal;

  constructor(steps: readonly SagaStep<C>[], journal: Journal) {
    this.steps = steps;
    this.journal = journal;
  }

  async run(initial: C): Promise<SagaOutcome<C>> {
    const ctx: C = initial;
    const completed: SagaStep<C>[] = [];
    const errors: Error[] = [];
    for (const step of this.steps) {
      const txId = (ctx as SplitAmortCtx).txId;
      try {
        this.journal.append({ txId: txId, step: step.name, phase: 'DO', at: new Date().toISOString() });
        await step.do(ctx);
        this.journal.append({ txId: txId, step: step.name, phase: 'OK', at: new Date().toISOString() });
        completed.unshift(step);
      } catch (err) {
        const failure = err instanceof Error ? err : new Error(String(err));
        errors.push(failure);
        this.journal.append({ txId: txId, step: step.name, phase: 'FAIL', at: new Date().toISOString() });
        for (const done of completed) {
          try {
            await done.undo(ctx);
            this.journal.append({ txId: txId, step: done.name, phase: 'UNDO', at: new Date().toISOString() });
          } catch (undoErr) {
            errors.push(undoErr instanceof Error ? undoErr : new Error(String(undoErr)));
          }
        }
        return { ok: false, failedAt: step.name, ctx: ctx, errors: errors, pending: this.journal.pending(txId) };
      }
    }
    return { ok: true, ctx: ctx };
  }
}

export function buildSplitAmortSaga(deps: {
  split: SplitDep;
  escrow: EscrowDep;
  amort: AmortizationDep;
  audit: AuditDep;
  dust: DustDep;
}): Saga<SplitAmortCtx> {
  const escrowFullDebit = function (ctx: SplitAmortCtx): Cents {
    const belowMin = ctx.fractionMicro < ctx.policy.minFractionMicro;
    if (belowMin && ctx.policy.onBelowMinFraction === 'RETURN_TO_ORIGIN') {
      return ctx.consumedCents;
    }
    return ctx.amortBucket;
  };

  const steps: Array<SagaStep<SplitAmortCtx>> = [
    {
      name: 'split',
      do: function (ctx) {
        ctx.buckets = deps.split.splitByBps(ctx.grossCents, ctx.bps);
        ctx.amortBucket = ctx.buckets[2];
        return Promise.resolve();
      },
      undo: function (ctx) {
        ctx.buckets = [];
        ctx.amortBucket = 0 as Cents;
        return Promise.resolve();
      }
    },
    {
      name: 'escrow.credit',
      do: function (ctx) {
        deps.escrow.credit(ctx.escrowAccount, ctx.amortBucket);
        return Promise.resolve();
      },
      undo: function (ctx) {
        const balance = deps.escrow.balance(ctx.escrowAccount);
        if (balance > 0) deps.escrow.debit(ctx.escrowAccount, balance);
        return Promise.resolve();
      }
    },
    {
      name: 'amort.baixa',
      do: function (ctx) {
        ctx.stockMicroBefore = deps.amort.stock(ctx.isin);
        const purchase = deps.amort.purchase(ctx.isin, ctx.amortBucket);
        ctx.fractionMicro = purchase.fractionMicro;
        ctx.consumedCents = purchase.consumedCents;
        ctx.residualCents = purchase.residualCents;
        ctx.stockMicroAfter = deps.amort.stock(ctx.isin);
        return Promise.resolve();
      },
      undo: function (ctx) {
        if (ctx.fractionMicro > 0) {
          deps.amort.rollback(ctx.isin, ctx.fractionMicro);
          ctx.fractionMicro = 0 as MicroFraction;
          ctx.consumedCents = 0 as Cents;
          ctx.residualCents = 0 as Cents;
          ctx.stockMicroAfter = deps.amort.stock(ctx.isin);
        }
        return Promise.resolve();
      }
    },
    {
      name: 'escrow.debit',
      do: function (ctx) {
        const amount = escrowFullDebit(ctx);
        if (amount > 0) deps.escrow.debit(ctx.escrowAccount, amount);
        ctx.escrowAfter = deps.escrow.balance(ctx.escrowAccount);
        return Promise.resolve();
      },
      undo: function (ctx) {
        const amount = escrowFullDebit(ctx);
        if (ctx.escrowAfter === 0 && amount > 0) {
          deps.escrow.credit(ctx.escrowAccount, amount);
        }
        ctx.escrowAfter = deps.escrow.balance(ctx.escrowAccount);
        return Promise.resolve();
      }
    },
    {
      name: 'dust.apply',
      do: function (ctx) {
        if (ctx.residualCents === 0) {
          ctx.dustApplied = 0 as Cents;
          return Promise.resolve();
        }
        if (ctx.policy.onResidual === 'FAIL') throw new Error('DUST_POLICY_FAIL: residuo com onResidual=FAIL');
        const belowMin = ctx.fractionMicro < ctx.policy.minFractionMicro;
        if (belowMin && ctx.policy.onBelowMinFraction === 'RETURN_TO_ORIGIN') {
          ctx.dustApplied = 0 as Cents;
          return Promise.resolve();
        }
        const dustEntry = deps.dust.credit({ tenant: ctx.tenant, isin: ctx.isin, reason: 'FRACTION_TRUNCATION', amountCents: ctx.residualCents, refTxId: ctx.txId });
        ctx.dustApplied = dustEntry.amountCents;
        return Promise.resolve();
      },
      undo: function (ctx) {
        if (ctx.dustApplied > 0) {
          deps.dust.debit(ctx.isin, ctx.dustApplied, 'MANUAL_ADJUSTMENT', ctx.txId, ctx.tenant);
          ctx.dustApplied = 0 as Cents;
        }
        return Promise.resolve();
      }
    },
    {
      name: 'audit.append',
      do: function (ctx) {
        const outcome = deps.audit.append('AMORTIZACAO_PARCIAL_EXECUTADA', {
          isin: ctx.isin,
          tenant: ctx.tenant,
          operation: ctx.operation,
          grossCents: ctx.grossCents,
          buckets: ctx.buckets,
          amortBucketCents: ctx.amortBucket,
          fractionMicro: ctx.fractionMicro,
          consumedCents: ctx.consumedCents,
          residualCents: ctx.residualCents,
          dustAppliedCents: ctx.dustApplied,
          stockMicroBefore: ctx.stockMicroBefore,
          stockMicroAfter: ctx.stockMicroAfter,
          policy: { onBelowMinFraction: ctx.policy.onBelowMinFraction, onResidual: ctx.policy.onResidual, minFractionMicro: ctx.policy.minFractionMicro }
        }, ctx.txId);
        ctx.seal = outcome;
        return Promise.resolve();
      },
      undo: function (ctx) {
        deps.audit.appendCompensation({ txId: ctx.txId, steps: ['audit.append'] });
        ctx.seal = null;
        return Promise.resolve();
      }
    }
  ];
  return new Saga<SplitAmortCtx>(steps, new InMemoryJournal());
}
