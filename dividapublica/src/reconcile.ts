import { Anchor, assertAnchored, UnanchoredChain } from './anchor';
import { AuditChain } from './audit-chain';
import { Cents, addCents } from './money';
import { DustLedger } from './dust';

export interface DailySnapshot {
  date: string;
  tenant: string;
  estoqueInicialMicro: number;
  estoqueFinalMicro: number;
  totalAmortizadoMicro: number;
  totalAmortizadoCents: Cents;
  totalDustCents: Cents;
  totalPagoAmortCents: Cents;
  eventsCount: number;
  chainHeadHash: string;
  anchor: Anchor;
}

export interface ReconcileViolation {
  rule: 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7';
  detail: string;
}

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function reconcile(params: {
  snapshot: DailySnapshot;
  dustLedger: DustLedger;
  auditChain: AuditChain;
  isins: readonly string[];
  previousSnapshot?: DailySnapshot;
}): { ok: boolean; violations: ReconcileViolation[] } {
  const s = params.snapshot;
  const violations: ReconcileViolation[] = [];

  // R1: estoqueFinal === estoqueInicial − totalAmortizado
  if (s.estoqueFinalMicro !== s.estoqueInicialMicro - s.totalAmortizadoMicro) {
    violations.push({ rule: 'R1', detail: 'estoqueFinal ' + s.estoqueFinalMicro + ' != estoqueInicial ' + s.estoqueInicialMicro + ' - amortizado ' + s.totalAmortizadoMicro });
  }

  // R2: totalDust + totalAmortizadoCents === totalPagoAmortCents (I7 global diário)
  if (addCents(s.totalDustCents, s.totalAmortizadoCents) !== s.totalPagoAmortCents) {
    violations.push({ rule: 'R2', detail: 'dust ' + s.totalDustCents + ' + amortizado ' + s.totalAmortizadoCents + ' != pago ' + s.totalPagoAmortCents });
  }

  // R3: chainHeadHash === recordHash do último evento do dia
  const dayRecords = params.auditChain.recordsForDate(s.date);
  const lastOfDay = dayRecords.length > 0 ? dayRecords[dayRecords.length - 1].recordHash : null;
  if (lastOfDay !== s.chainHeadHash) {
    violations.push({ rule: 'R3', detail: 'chainHeadHash do snapshot difere do último evento do dia ' + s.date });
  }

  // R4: anchor.chainHeadHash === chainHeadHash
  try {
    assertAnchored({ hash: s.chainHeadHash, index: s.eventsCount }, s.anchor);
  } catch (err) {
    if (err instanceof UnanchoredChain) {
      violations.push({ rule: 'R4', detail: 'anchor divergente da cabeça da cadeia: ' + err.message });
    } else {
      throw err;
    }
  }

  // R5: snapshot.date consecutivo ao previousSnapshot.date
  if (params.previousSnapshot) {
    const expected = addDays(params.previousSnapshot.date, 1);
    if (s.date !== expected) {
      violations.push({ rule: 'R5', detail: 'gap de dia: esperado ' + expected + ', recebido ' + s.date });
    }

    // R6: previousSnapshot.chainHeadHash === primeiro prevHash do dia atual
    const nextYear = addDays(s.date, 1);
    void nextYear;
    const firstOfDay = dayRecords.length > 0 ? dayRecords[0].prevHash : null;
    if (firstOfDay !== params.previousSnapshot.chainHeadHash) {
      violations.push({ rule: 'R6', detail: 'primeiro prevHash do dia ' + s.date + ' difere do chainHead do dia anterior' });
    }
  }

  // R7: Σ dustBalance por ISIN === totalDustCents
  let dustSum = 0 as Cents;
  for (const isin of params.isins) {
    dustSum = addCents(dustSum, params.dustLedger.balance(isin));
  }
  if (dustSum !== s.totalDustCents) {
    violations.push({ rule: 'R7', detail: 'Σ dust por ISIN (' + dustSum + ') difere de totalDustCents (' + s.totalDustCents + ')' });
  }

  return { ok: violations.length === 0, violations: violations };
}
