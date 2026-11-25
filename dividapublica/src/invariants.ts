import { DustPolicy } from './dust';
import { addCents, Cents, MicroFraction } from './money';

export type InvariantId = 'I1' | 'I2' | 'I3' | 'I4' | 'I5' | 'I6' | 'I7' | 'I8';

export class InvariantViolation extends Error {
  readonly id: InvariantId;
  constructor(id: InvariantId, detail: string) {
    super('INVARIANT_VIOLATION[' + id + ']: ' + detail);
    this.name = 'InvariantViolation';
    this.id = id;
  }
}

export interface InvariantContext {
  bruto: Cents;
  buckets: readonly Cents[];
  bucketAmort: Cents;
  puCents: number;
  policy: DustPolicy;
  fracaoMicro: MicroFraction;
  estoqueMicro: number;
  escrowAfter: Cents;
  dustApplied: Cents;
  amortizadoCents: Cents;
  pagoAmortCents: Cents;
  auditChainVerifies: () => boolean;
}

// INVARIANTE I1: Σ buckets === bruto (conservacao do split)
export const I1 = (ctx: InvariantContext): boolean => {
  let sum = 0;
  for (const b of ctx.buckets) sum += b;
  return sum === ctx.bruto;
};

// INVARIANTE I2: todos os buckets são inteiros
export const I2 = (ctx: InvariantContext): boolean => {
  for (const b of ctx.buckets) {
    if (!Number.isInteger(b)) return false;
  }
  return true;
};

// INVARIANTE I3: todos os buckets sao nao-negativos
export const I3 = (ctx: InvariantContext): boolean => {
  for (const b of ctx.buckets) {
    if (b < 0) return false;
  }
  return true;
};

// INVARIANTE I4: conversao escrow→fracao é exata em 1e-6, ou política de dust absorve o resíduo
export const I4 = (ctx: InvariantContext): boolean => {
  if ((BigInt(ctx.bucketAmort) * 1000000n) % BigInt(ctx.puCents) === 0n) return true;
  return ctx.policy.onBelowMinFraction === 'ACCUMULATE';
};

// INVARIANTE I5: fração baixada <= estoque disponível (antes da baixa)
export const I5 = (ctx: InvariantContext): boolean => {
  return ctx.fracaoMicro <= ctx.estoqueMicro;
};

// INVARIANTE I6: escrow de amortizacao zerado após a baixa
export const I6 = (ctx: InvariantContext): boolean => {
  return ctx.escrowAfter === 0;
};

// INVARIANTE I7: dust retido + amortizado === pago ao bucket de amortização (conservação)
export const I7 = (ctx: InvariantContext): boolean => {
  return addCents(ctx.dustApplied, ctx.amortizadoCents) === ctx.pagoAmortCents;
};

// INVARIANTE I8: cadeia de auditoria intégra (encadeamento SHA-256 verificável)
export const I8 = (ctx: InvariantContext): boolean => {
  return ctx.auditChainVerifies();
};

export function checkAll(ctx: InvariantContext): Array<{ id: InvariantId; ok: boolean }> {
  return [
    { id: 'I1', ok: I1(ctx) },
    { id: 'I2', ok: I2(ctx) },
    { id: 'I3', ok: I3(ctx) },
    { id: 'I4', ok: I4(ctx) },
    { id: 'I5', ok: I5(ctx) },
    { id: 'I6', ok: I6(ctx) },
    { id: 'I7', ok: I7(ctx) },
    { id: 'I8', ok: I8(ctx) }
  ];
}

export function assertAll(ctx: InvariantContext): void {
  for (const result of checkAll(ctx)) {
    if (!result.ok) throw new InvariantViolation(result.id, 'invariante violada no contexto da transacao');
  }
}
