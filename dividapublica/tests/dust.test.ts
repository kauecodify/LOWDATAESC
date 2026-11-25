import * as assert from 'node:assert';
import { computeResidual, DustLedgerImpl, InsufficientDust, applyDustPolicy, DustPolicy, ResidualNotAllowed } from '../src/dust';
import { assertCents, assertMicro, Cents, MicroFraction, mulDivFloor, subCents } from '../src/money';

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

const POLICY: DustPolicy = {
  minFractionMicro: assertMicro(1),
  onResidual: 'ACCUMULATE',
  onBelowMinFraction: 'ACCUMULATE'
};

let clockTick = 0;
const fixedClock = function (): string {
  clockTick += 1;
  return new Date(1700000000000 + clockTick).toISOString();
};

check('split com residuo forcado -> ACCUMULATE registra entradas encadeadas', function () {
  const ledger = new DustLedgerImpl(fixedClock);
  const entry = ledger.credit({ tenant: 'GOV-BR-STN-01', isin: 'BRSTNCLF1RC4', reason: 'FRACTION_TRUNCATION', amountCents: assertCents(7) as Cents, refTxId: 'TX-1' });
  assert.strictEqual(entry.amountCents, 7);
  assert.strictEqual(ledger.balance('BRSTNCLF1RC4'), 7);
  assert.strictEqual(entry.prevHash, '0x' + '0'.repeat(64), 'primeiro encadeamento parte do GENESIS_HASH');
  const second = ledger.credit({ tenant: 'GOV-BR-STN-01', isin: 'BRSTNCLF1RC4', reason: 'SPLIT_REMAINDER', amountCents: assertCents(3) as Cents, refTxId: 'TX-2' });
  assert.strictEqual(second.prevHash, entry.recordHash, 'encadeamento por (tenant, isin)');
  ledger.debit('BRSTNCLF1RC4', assertCents(4) as Cents, 'MANUAL_ADJUSTMENT', 'TX-3');
  // Invariante ID: balance === Σ credit − Σ debit
  let sumCredit = 0;
  let sumDebit = 0;
  for (const e of ledger.history('BRSTNCLF1RC4')) {
    if (e.direction === 'DEBIT') sumDebit += e.amountCents;
    else sumCredit += e.amountCents;
  }
  assert.strictEqual(sumCredit, 10);
  assert.strictEqual(sumDebit, 4);
  assert.strictEqual(ledger.balance('BRSTNCLF1RC4'), sumCredit - sumDebit);
});

check('debit maior que saldo lanca InsufficientDust; saldo nunca negativo', function () {
  const ledger = new DustLedgerImpl(fixedClock);
  ledger.credit({ tenant: 'GOV-BR-STN-01', isin: 'BRSTNCLF1RC4', reason: 'FRACTION_TRUNCATION', amountCents: assertCents(5) as Cents, refTxId: null });
  assert.throws(function () {
    ledger.debit('BRSTNCLF1RC4', assertCents(6) as Cents, 'MANUAL_ADJUSTMENT');
  }, InsufficientDust);
  assert.strictEqual(ledger.balance('BRSTNCLF1RC4'), 5);
});

check('fração truncada (PU=1333333): floor + dust de fração', function () {
  const pu = 1333333;
  const pago = assertCents(7500);
  const fractionMicro = mulDivFloor(pago, 1000000, pu);
  assert.strictEqual(fractionMicro, 5625);
  const consumed = mulDivFloor(fractionMicro, pu, 1000000);
  assert.strictEqual(consumed, 7499);
  const residual = subCents(pago, assertCents(consumed));
  assert.strictEqual(residual, 1);
  const ledger = new DustLedgerImpl(fixedClock);
  const applied = applyDustPolicy(residual, POLICY, ledger, { tenant: 'GOV-BR-STN-01', isin: 'BRSTNCLF1RC4', refTxId: 'TX-TRUNC' });
  assert.strictEqual(applied.applied, 1);
  // INVARIANTE I7: dust retido + amortizado === pago ao bucket de amortização
  assert.strictEqual(applied.applied + consumed, pago);
});

check('onResidual=FAIL com residuo lanca ResidualNotAllowed', function () {
  const ledger = new DustLedgerImpl(fixedClock);
  const strictPolicy: DustPolicy = { minFractionMicro: assertMicro(1), onResidual: 'FAIL', onBelowMinFraction: 'ACCUMULATE' };
  assert.throws(function () {
    applyDustPolicy(assertCents(2) as Cents, strictPolicy, ledger, { tenant: 'GOV-BR-STN-01', isin: 'BRSTNCLF1RC4', refTxId: 'TX-X' });
  }, ResidualNotAllowed);
});

check('computeResidual: total - Σ buckets', function () {
  assert.strictEqual(computeResidual(assertCents(100), [assertCents(40) as Cents, assertCents(59) as Cents, assertCents(1) as Cents, 0 as Cents]), 0);
  assert.strictEqual(computeResidual(assertCents(100), [assertCents(40) as Cents, assertCents(59) as Cents, 0 as Cents, 0 as Cents]), 1);
});

check('1.000 operacoes: Σ dust + Σ amortizado === Σ pago (conservacao)', function () {
  const ledger = new DustLedgerImpl(fixedClock);
  const pu = 1333333;
  let paidTotal = 0;
  let dustTotal = 0;
  let amortizedTotal = 0;
  for (let i = 0; i < 1000; i++) {
    const paid = assertCents(100 + (i % 9000));
    paidTotal += paid;
    const fractionMicro = mulDivFloor(paid, 1000000, pu);
    const consumed = mulDivFloor(fractionMicro, pu, 1000000);
    const residual = subCents(paid, assertCents(consumed));
    amortizedTotal += consumed;
    if (residual > 0) {
      ledger.credit({ tenant: 'GOV-BR-STN-01', isin: 'BRSTNCLF1RC4', reason: 'FRACTION_TRUNCATION', amountCents: residual, refTxId: 'TX-' + i });
      dustTotal += residual;
    }
  }
  assert.strictEqual(amortizedTotal + dustTotal, paidTotal, 'conservacao de centavos em 1.000 operacoes');
  assert.strictEqual(ledger.balance('BRSTNCLF1RC4'), dustTotal);
});

if (failed > 0) {
  console.error('DUST TESTS FALHARAM: ' + passed + ' ok, ' + failed + ' falha(s)');
  process.exit(1);
}
console.log('dust.test.ts OK: ' + passed + ' checks, conservacao 1.000/1.000 operacoes');
