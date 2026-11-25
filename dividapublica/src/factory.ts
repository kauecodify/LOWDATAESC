import { InMemoryAnchor } from './anchor';
import { AuditChain } from './audit-chain';
import { DustLedgerImpl, DustPolicy } from './dust';
import { DebtControlEngine, EngineDeps, WhitelistRejected } from './engine';
import { EscrowTreasury } from './escrow-treasury';
import { InMemoryIdempotencyStore } from './idempotency';
import {
  addCents, assertCents, Cents, MicroFraction, mulDivFloor, splitByBps, subCents
} from './money';
import { verifyZeroTrust } from './split-engine';
import { AmortizationDep, EscrowDep, InsufficientStock } from './saga';

export const TENANT_GOVERNMENTAL_DEFAULT = 'GOV-BR-STN-01';
export const ISIN_DEFAULT = 'BRSTNCLF1RC4';

export class StockRegistry implements AmortizationDep {
  private readonly records = new Map<string, { pu: number; stock: number }>();

  register(isin: string, pu: number, stockMicro: number): void {
    this.records.set(isin, { pu: pu, stock: stockMicro });
  }

  pu(isin: string): number {
    const rec = this.records.get(isin);
    if (!rec) throw new Error('titulo nao registrado: ' + isin);
    return rec.pu;
  }

  stock(isin: string): number {
    const rec = this.records.get(isin);
    if (!rec) throw new Error('titulo nao registrado: ' + isin);
    return rec.stock;
  }

  purchase(isin: string, amountCents: Cents): { fractionMicro: MicroFraction; consumedCents: Cents; residualCents: Cents } {
    const rec = this.records.get(isin);
    if (!rec) throw new Error('titulo nao registrado: ' + isin);
    const fractionMicro = mulDivFloor(amountCents, 1000000, rec.pu);
    if (fractionMicro > rec.stock) throw new InsufficientStock(isin);
    const consumed = mulDivFloor(fractionMicro, rec.pu, 1000000);
    rec.stock -= fractionMicro;
    return {
      fractionMicro: fractionMicro as MicroFraction,
      consumedCents: assertCents(consumed),
      residualCents: subCents(amountCents, assertCents(consumed))
    };
  }

  rollback(isin: string, fractionMicro: MicroFraction): void {
    const rec = this.records.get(isin);
    if (!rec) throw new Error('titulo nao registrado: ' + isin);
    rec.stock += fractionMicro;
  }
}

class EscrowAdapter implements EscrowDep {
  constructor(private readonly treasury: EscrowTreasury) {}

  credit(account: string, amountCents: Cents): Cents {
    return assertCents(this.treasury.deposit(account, amountCents, 'saga escrow.credit'));
  }

  debit(account: string, amountCents: Cents): Cents {
    return assertCents(this.treasury.debit(account, amountCents, 'saga escrow.debit'));
  }

  balance(account: string): Cents {
    return assertCents(this.treasury.getBalance(account));
  }
}

export const DUST_POLICY_DEFAULT: DustPolicy = {
  minFractionMicro: 1 as MicroFraction,
  onResidual: 'ACCUMULATE',
  onBelowMinFraction: 'ACCUMULATE'
};

export interface DebtControlStack {
  engine: DebtControlEngine;
  treasury: EscrowTreasury;
  registry: StockRegistry;
  ledger: DustLedgerImpl;
  audit: AuditChain;
  idem: InMemoryIdempotencyStore;
  anchorBackend: InMemoryAnchor;
  deps: EngineDeps;
}

export function createDebtControlStack(options?: {
  clock?: () => string;
  policy?: DustPolicy;
  bps?: readonly number[];
  pu?: number;
  initialStockMicro?: number;
  antifraudMinScore?: number;
  whitelist?: { tenantId: string; allowedOperations: readonly string[]; bondsWhitelist: readonly string[] };
}): DebtControlStack {
  const clock = options?.clock || function () { return new Date().toISOString(); };
  const policy = options?.policy || DUST_POLICY_DEFAULT;
  const bps = options?.bps || [7500, 1700, 750, 50];
  const pu = options?.pu === undefined ? 1500000 : options.pu;
  const initialStock = options?.initialStockMicro === undefined ? 4000000 : options.initialStockMicro;
  const minScore = options?.antifraudMinScore === undefined ? 90 : options.antifraudMinScore;
  const whitelist = options?.whitelist || {
    tenantId: TENANT_GOVERNMENTAL_DEFAULT,
    allowedOperations: ['SPLIT_D0_AMORTIZACAO_LFT', 'BAIXA_FRACAO_TITULO'] as readonly string[],
    bondsWhitelist: [ISIN_DEFAULT] as readonly string[]
  };

  const treasury = new EscrowTreasury();
  treasury.registerBond({ isin: ISIN_DEFAULT, description: 'LFT Tesouro Selic - estoque custodiado', puCents: pu }, initialStock);
  treasury.openEscrowAccount('FUNDO_AMORTIZACAO_DIVIDA', 'Fundo escrow de amortizacao da divida');

  const registry = new StockRegistry();
  registry.register(ISIN_DEFAULT, pu, initialStock);

  const ledger = new DustLedgerImpl(clock);
  const audit = new AuditChain({ clock: clock });
  const idem = new InMemoryIdempotencyStore();
  const anchorBackend = new InMemoryAnchor();

  const deps: EngineDeps = {
    whitelabel: {
      assertOperationAllowed: function (tenant: string, operation: string) {
        if (tenant !== whitelist.tenantId) throw new WhitelistRejected('tenant ' + tenant + ' fora da whitelist');
        if (whitelist.allowedOperations.indexOf(operation) === -1) throw new WhitelistRejected('operacao ' + operation + ' fora da whitelist');
      },
      assertBondAllowed: function (tenant: string, isin: string) {
        void tenant;
        if (whitelist.bondsWhitelist.indexOf(isin) === -1) throw new WhitelistRejected('titulo ' + isin + ' fora da whitelist');
      }
    },
    zeroTrust: {
      verify: function (ctx) {
        verifyZeroTrust({
          deviceSignature: ctx.deviceSig,
          kycKybToken: ctx.kycToken,
          antifraudScore: ctx.antifraudScore
        }, minScore);
      }
    },
    split: {
      splitByBps: function (total: Cents, b: readonly number[]) { return splitByBps(total, b); }
    },
    escrow: new EscrowAdapter(treasury),
    amort: registry,
    dust: ledger,
    audit: audit,
    idem: idem,
    anchor: anchorBackend,
    policy: policy,
    clock: clock,
    bps: bps,
    minAntifraudScore: minScore
  };

  return {
    engine: new DebtControlEngine(deps),
    treasury: treasury,
    registry: registry,
    ledger: ledger,
    audit: audit,
    idem: idem,
    anchorBackend: anchorBackend,
    deps: deps
  };
}
