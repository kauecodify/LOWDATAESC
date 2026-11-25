export type Cents = number & { readonly __brand: 'Cents' };
export type MicroFraction = number & { readonly __brand: 'MicroFraction' };

export const BPS_TOTAL = 10000;

export class NonIntegerCents extends Error {
  readonly value: number;
  constructor(value: number) {
    super('NON_INTEGER_CENTS: valor monetario deve ser inteiro nao negativo em centavos, recebido ' + String(value));
    this.name = 'NonIntegerCents';
    this.value = value;
  }
}

export class NonIntegerMicro extends Error {
  readonly value: number;
  constructor(value: number) {
    super('NON_INTEGER_MICRO: fracao deve ser inteira nao negativa em micro-fracoes (1e-6), recebido ' + String(value));
    this.name = 'NonIntegerMicro';
    this.value = value;
  }
}

export class NegativeBalance extends Error {
  constructor(a: number, b: number) {
    super('NEGATIVE_BALANCE: ' + String(b) + ' > ' + String(a) + ' em subCents');
    this.name = 'NegativeBalance';
  }
}

export class OverflowMonetary extends Error {
  constructor(value: number) {
    super('OVERFLOW_MONETARY: ' + String(value) + ' excede MAX_SAFE_INTEGER');
    this.name = 'OverflowMonetary';
  }
}

export class InvalidBpsSum extends Error {
  constructor(sum: number, bps: readonly number[]) {
    super('INVALID_BPS_SUM: soma ' + String(sum) + ' difere de ' + String(BPS_TOTAL) + ' bps [' + bps.join(',') + ']');
    this.name = 'InvalidBpsSum';
  }
}

function isSafeNonNegative(v: number): boolean {
  return Number.isInteger(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER;
}

export function assertCents(v: number): Cents {
  if (!isSafeNonNegative(v)) throw new NonIntegerCents(v);
  return v as Cents;
}

export function assertMicro(v: number): MicroFraction {
  if (!isSafeNonNegative(v)) throw new NonIntegerMicro(v);
  return v as MicroFraction;
}

export function addCents(a: Cents, b: Cents): Cents {
  const s = a + b;
  if (!Number.isInteger(s) || s > Number.MAX_SAFE_INTEGER) throw new OverflowMonetary(s);
  return s as Cents;
}

export function subCents(a: Cents, b: Cents): Cents {
  if (b > a) throw new NegativeBalance(a, b);
  return (a - b) as Cents;
}

// (a*b)/d em inteiro, sem float. Usa BigInt internamente para evitar overflow
// em produtos de centavos (ate 1e10) por escala 1e6 (1e16 > MAX_SAFE_INTEGER).
export function mulDivFloor(a: number, b: number, d: number): number {
  if (!Number.isInteger(a) || !Number.isInteger(b) || !Number.isInteger(d)) {
    throw new Error('mulDivFloor: entradas devem ser inteiras');
  }
  if (d <= 0) throw new Error('mulDivFloor: divisor deve ser positivo');
  if (a < 0 || b < 0) throw new Error('mulDivFloor: entradas devem ser nao negativas');
  const q = (BigInt(a) * BigInt(b)) / BigInt(d);
  if (q > BigInt(Number.MAX_SAFE_INTEGER)) throw new OverflowMonetary(Number(q));
  return Number(q);
}

// Primeiro resto de (a*b) % d sem float.
export function mulMod(a: number, b: number, d: number): number {
  if (!Number.isInteger(a) || !Number.isInteger(b) || !Number.isInteger(d)) {
    throw new Error('mulMod: entradas devem ser inteiras');
  }
  if (d <= 0) throw new Error('mulMod: divisor deve ser positivo');
  return Number((BigInt(a) * BigInt(b)) % BigInt(d));
}

// INVARIANTE I1: Σ result === total
// INVARIANTE I2: todos inteiros
// INVARIANTE I3: todos >= 0
// Maior resto determinístico; empate resolvido por índice ASCII ASCendente (menor índice primeiro).
export function splitByBps(total: Cents, bps: readonly number[]): Cents[] {
  let sum = 0;
  for (const b of bps) {
    if (!Number.isInteger(b) || b < 0) throw new InvalidBpsSum(-1, bps);
    sum += b;
  }
  if (sum !== BPS_TOTAL) throw new InvalidBpsSum(sum, bps);

  const parts: Cents[] = new Array(bps.length).fill(0 as Cents);
  const remainders: number[] = new Array(bps.length).fill(0);
  let distributed = 0;
  for (let i = 0; i < bps.length; i++) {
    parts[i] = assertCents(mulDivFloor(total, bps[i] as number, BPS_TOTAL));
    remainders[i] = mulMod(total, bps[i] as number, BPS_TOTAL);
    distributed += parts[i];
  }
  let rest = total - distributed;
  const order: number[] = bps.map(function (_b, i) { return i; }).sort(function (a, b) {
    if (remainders[b] !== remainders[a]) return remainders[b] - remainders[a];
    return a - b;
  });
  for (let i = 0; i < order.length && rest > 0; i++) {
    parts[order[i]] = addCents(parts[order[i]], 1 as Cents);
    rest -= 1;
  }
  const totalOut = parts.reduce(function (acc: number, p: Cents) { return acc + p; }, 0);
  if (totalOut !== total) throw new InvalidBpsSum(totalOut, bps);
  return parts;
}
