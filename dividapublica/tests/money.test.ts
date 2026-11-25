import * as assert from 'node:assert';
import { addCents, assertCents, BPS_TOTAL, mulDivFloor, mulMod, NegativeBalance, NonIntegerCents, OverflowMonetary, InvalidBpsSum, splitByBps, subCents } from '../src/money';

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    console.error('[FALHA] ' + name + ' -> ' + ((err as Error).message || String(err)));
  }
}

function assertConservation(total: number, bps: readonly number[]): void {
  const parts = splitByBps(assertCents(total), bps);
  let sum = 0;
  for (const p of parts) sum += p;
  assert.strictEqual(sum, total, 'I1 violada para total=' + total);
  for (const p of parts) {
    assert.ok(Number.isInteger(p), 'I2 violada para total=' + total);
    assert.ok(p >= 0, 'I3 violada para total=' + total);
  }
}

// Fuzz reproduzível: LCG dedicado (sem Math.random) para determinismo.
let seed = 0x2f6e2b1;
function nextRandom(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

check('fuzz 10.000 valores 1..1e10 conservam I1-I3', function () {
  for (let i = 0; i < 10000; i++) {
    const total = 1 + Math.floor(nextRandom() * 1e10);
    assertConservation(total, [7500, 1700, 750, 50]);
  }
});

check('fuzz 10.000 com 3 buckets (bps distintos) conservam', function () {
  for (let i = 0; i < 10000; i++) {
    const total = 1 + Math.floor(nextRandom() * 1e10);
    assertConservation(total, [5000, 4999, 1]);
  }
});

check('bordas: total=0, total=1, total=999999 fecham', function () {
  assertConservation(0, [7500, 1700, 750, 50]);
  assertConservation(1, [7500, 1700, 750, 50]);
  assertConservation(999999, [7500, 1700, 750, 50]);
  assert.deepStrictEqual(splitByBps(assertCents(1), [7500, 1700, 750, 50]), [1, 0, 0, 0]);
});

check('empates por índice ASC (tetos iguais)', function () {
  const parts = splitByBps(assertCents(100), [2500, 2500, 2500, 2500]);
  assert.deepStrictEqual(parts, [25, 25, 25, 25]);
  const tied = splitByBps(assertCents(3), [3334, 3333, 3333]);
  assert.strictEqual(tied[0] + tied[1] + tied[2], 3);
  assert.ok(tied[0] >= tied[1] && tied[1] >= tied[2], 'maior resto primeiro; empate por índice ASC');
});

check('soma bps invalida lanca InvalidBpsSum', function () {
  assert.throws(function () { splitByBps(assertCents(100), [5000, 5000, 1]); }, InvalidBpsSum);
});

check('assertCents/subCents/addCents', function () {
  assert.throws(function () { assertCents(1.5); }, NonIntegerCents);
  assert.throws(function () { assertCents(-1); }, NonIntegerCents);
  assert.strictEqual(addCents(assertCents(2), assertCents(3)), 5);
  assert.strictEqual(subCents(assertCents(3), assertCents(2)), 1);
  assert.throws(function () { subCents(assertCents(1), assertCents(2)); }, NegativeBalance);
  assert.throws(function () { addCents(assertCents(Number.MAX_SAFE_INTEGER), assertCents(1)); }, OverflowMonetary);
});

check('mulDivFloor/mulMod: (a*b)/d exato sem float', function () {
  assert.strictEqual(mulDivFloor(10000000, 750, 10000), 750000);
  assert.strictEqual(mulDivFloor(7, 1000000, 1333333), 5);
  assert.strictEqual(mulMod(10000000, 750, 10000), 0);
  assert.strictEqual(mulMod(7, 1000000, 1333333), 7 * 1000000 - 5 * 1333333);
  assert.strictEqual(mulDivFloor(1e10, 10000, BPS_TOTAL), 1e10);
});

if (failed > 0) {
  console.error('MONEY TESTS FALHARAM: ' + passed + ' ok, ' + failed + ' falha(s)');
  process.exit(1);
}
console.log('money.test.ts OK: ' + passed + ' checks, fuzz 10.000/10.000 conservando centavos');
