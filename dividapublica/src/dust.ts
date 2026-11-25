import { hashRecord, GENESIS_HASH } from './canonical';
import { addCents, assertCents, assertMicro, Cents, MicroFraction, subCents } from './money';

export type DustReason =
  | 'SPLIT_REMAINDER'
  | 'FRACTION_TRUNCATION'
  | 'PU_ROUNDING'
  | 'INSUFFICIENT_STOCK_CARRY'
  | 'MANUAL_ADJUSTMENT';

export interface DustEntry {
  id: string;
  tenant: string;
  isin: string;
  reason: DustReason;
  amountCents: Cents;
  refTxId: string | null;
  createdAt: string;
  prevHash: string;
  recordHash: string;
}

export class InsufficientDust extends Error {
  readonly isin: string;
  readonly requested: number;
  readonly available: number;
  constructor(isin: string, requested: number, available: number) {
    super('DUST_INSUFFICIENT: saldo dust de ' + isin + ' insuficiente (' + String(available) + ' < ' + String(requested) + ')');
    this.name = 'InsufficientDust';
    this.isin = isin;
    this.requested = requested;
    this.available = available;
  }
}

export interface DustPolicy {
  minFractionMicro: MicroFraction;
  onResidual: 'FAIL' | 'ACCUMULATE';
  onBelowMinFraction: 'ACCUMULATE' | 'RETURN_TO_ORIGIN';
}

export class ResidualNotAllowed extends Error {
  readonly residual: number;
  constructor(residual: number) {
    super('DUST_POLICY_FAIL: residuo ' + String(residual) + ' maior que zero com onResidual=FAIL');
    this.name = 'ResidualNotAllowed';
    this.residual = residual;
  }
}

export interface DustCreditInput {
  tenant: string;
  isin: string;
  reason: DustReason;
  amountCents: Cents;
  refTxId: string | null;
}

// ULID cánico: tempo 48 bits + aleatoriedade 80 bits em Crockford base32 (26 chars).
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function newUlid(now: number = Date.now()): string {
  let time = now;
  let out = '';
  for (let i = 0; i < 10; i++) {
    out = CROCKFORD.charAt(time % 32) + out;
    time = Math.floor(time / 32);
  }
  let rand = '';
  for (let i = 0; i < 16; i++) {
    rand += CROCKFORD.charAt(Math.floor(Math.random() * 32));
  }
  return out + rand;
}

export interface DustLedger {
  credit(entry: DustCreditInput): DustEntry;
  debit(isin: string, amountCents: Cents, reason: DustReason, refTxId?: string, tenant?: string): DustEntry;
  balance(isin: string): Cents;
  history(isin: string): readonly DustEntry[];
}

// INVARIANTE ID: balance(isin) === Σ credit.amount − Σ debit.amount
// INVARIANTE IR: balance(isin) >= 0 sempre (debit lanca InsufficientDust)
// Ledger de dupla entrada: cada evento gera 2 lançamentos (contra-partida débito/crédito da conta dust).
export class DustLedgerImpl implements DustLedger {
  private readonly entriesByScope = new Map<string, DustEntry[]>();
  private readonly balanceByScope = new Map<string, number>();
  private readonly lastHashByScope = new Map<string, string>();

  constructor(private readonly clock: () => string = function () { return new Date().toISOString(); }) {}

  private scope(tenant: string, isin: string): string {
    return tenant + '|' + isin;
  }

  credit(entry: DustCreditInput): DustEntry {
    assertCents(entry.amountCents);
    if (entry.amountCents === 0) throw new InsufficientDust(entry.isin, 0, 0);
    const scope = this.scope(entry.tenant, entry.isin);
    const prevHash = this.lastHashByScope.get(scope) || GENESIS_HASH;
    const createdAt = this.clock();
    const id = newUlid(Date.parse(createdAt) || Date.now());
    const hashedPayload = {
      id: id,
      isin: entry.isin,
      reason: entry.reason,
      refTxId: entry.refTxId,
      tenant: entry.tenant,
      amountCents: entry.amountCents,
      createdAt: createdAt
    };
    const full: DustEntry = {
      id: id,
      tenant: entry.tenant,
      isin: entry.isin,
      reason: entry.reason,
      amountCents: entry.amountCents,
      refTxId: entry.refTxId,
      createdAt: createdAt,
      prevHash: prevHash,
      recordHash: hashRecord(prevHash, hashedPayload)
    };
    this.lastHashByScope.set(scope, full.recordHash);
    const list = this.entriesByScope.get(scope) || [];
    list.push(full);
    this.entriesByScope.set(scope, list);
    this.balanceByScope.set(scope, addCents(assertCents(this.balanceByScope.get(scope) || 0), full.amountCents));
    return full;
  }

  debit(isin: string, amountCents: Cents, reason: DustReason, refTxId?: string, tenant: string = 'GOV-BR-STN-01'): DustEntry {
    assertCents(amountCents);
    if (amountCents === 0) throw new InsufficientDust(isin, 0, this.balance(isin));
    const scope = this.scope(tenant, isin);
    const available = this.balanceByScope.get(scope) || 0;
    if (amountCents > available) throw new InsufficientDust(isin, amountCents, available);
    const entry = this.credit({ tenant: tenant, isin: isin, reason: reason, amountCents: amountCents as Cents, refTxId: refTxId || null });
    this.balanceByScope.set(scope, subCents(assertCents(this.balanceByScope.get(scope) || 0), amountCents));
    return entry;
  }

  balance(isin: string): Cents {
    let total = 0;
    this.balanceByScope.forEach(function (v, scope) {
      if (scope.indexOf('|' + isin, scope.length - isin.length - 1) !== -1) total += v;
    });
    return assertCents(total);
  }

  history(isin: string): readonly DustEntry[] {
    const out: DustEntry[] = [];
    this.entriesByScope.forEach(function (list, scope) {
      if (scope.indexOf('|' + isin, scope.length - isin.length - 1) !== -1) {
        for (const e of list) out.push(e);
      }
    });
    return out;
  }

  balanceOfScope(tenant: string, isin: string): Cents {
    return assertCents(this.balanceByScope.get(this.scope(tenant, isin)) || 0);
  }
}

export function computeResidual(totalCents: Cents, buckets: readonly Cents[]): Cents {
  let sum: Cents = 0 as Cents;
  for (const b of buckets) {
    sum = addCents(sum, b);
  }
  return subCents(totalCents, sum);
}

export function applyDustPolicy(
  residual: Cents,
  policy: DustPolicy,
  ledger: DustLedger,
  ctx: { tenant: string; isin: string; refTxId: string }
): { applied: Cents; reason: DustReason } {
  if (residual === 0) return { applied: 0 as Cents, reason: 'SPLIT_REMAINDER' };
  if (policy.onResidual === 'FAIL') throw new ResidualNotAllowed(residual);
  const entry = ledger.credit({ tenant: ctx.tenant, isin: ctx.isin, reason: 'SPLIT_REMAINDER', amountCents: residual, refTxId: ctx.refTxId });
  return { applied: entry.amountCents, reason: entry.reason };
}
