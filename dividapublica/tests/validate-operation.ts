import * as assert from 'node:assert';
import { randomBytes } from 'node:crypto';
import { AuditTrail, canonicalJson, sha256Hex } from '../src/audit-trail';
import { EscrowTreasury } from '../src/escrow-treasury';
import { SPLIT_POLICY_BPS, computeSplit, formatBRL, formatFraction, verifyZeroTrust } from '../src/split-engine';
import { WHITELABEL_TENANT, assertB2GOperationWhitelisted, assertBondWhitelisted } from '../whitelabel/b2g-operations';

const GROSS_CENTS = 10000000;
const ISIN = 'BRSTNCLF1RC4';
const BOND_PU_CENTS = 1500000;
const INITIAL_DEBT_FRAC_PICO = 4000000;
const FRACTION_SCALE = 1000000;

let passed = 0;
const failures: string[] = [];

function step(name: string, run: () => void): void {
  try {
    run();
    passed++;
    console.log('  [OK] ' + name);
  } catch (err) {
    failures.push(name + ' -> ' + ((err as Error).message || String(err)));
    console.log('  [FALHA] ' + name);
  }
}

console.log('=== LOWDATAESC B2G - validacao E2E: Split Payment com amortizacao parcial de divida publica (D-0) ===');
console.log('Tenant whitelabel: ' + WHITELABEL_TENANT.brand.platformLabel + ' | ' + WHITELABEL_TENANT.tenantId);
console.log('');

let operation: ReturnType<typeof assertB2GOperationWhitelisted> | undefined;
let treasury: EscrowTreasury | undefined;
let split: ReturnType<typeof computeSplit> | undefined;
let order: ReturnType<EscrowTreasury['amortizeDebt']> | undefined;
let proof: ReturnType<AuditTrail['sealFinalPayload']> | undefined;
let proofHash = '';

import { canonicalJson as canonicalJsonV1, GENESIS_HASH, hashRecord, verifyChain as verifyCanonicalChain } from '../src/canonical';
import { assertCents as assertCentsM, splitByBps, mulDivFloor, subCents as subCentsM, Cents as BrandCents, MicroFraction as BrandMicro } from '../src/money';
import { DustPolicy } from '../src/dust';
import { checkAll, assertAll, InvariantViolation, InvariantContext, InvariantId } from '../src/invariants';
import { UnanchoredChain, assertAnchored } from '../src/anchor';
import { buildSplitAmortSaga, InMemoryJournal, SplitAmortCtx, InsufficientStock } from '../src/saga';
import { AuditChain } from '../src/audit-chain';
import { EngineCode, OperationRequest, ESCROW_AMORT_ACCOUNT } from '../src/engine';
import { reconcile } from '../src/reconcile';
import { createDebtControlStack, DUST_POLICY_DEFAULT, ISIN_DEFAULT, TENANT_GOVERNMENTAL_DEFAULT } from '../src/factory';

// ======================= ETAPA 5+ — Camada de controle exata e dust (T13-T30) ======================

const txId = 'TX-D0-' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '-' + randomBytes(3).toString('hex').toUpperCase();

console.log('ETAPA 1 - Whitelabel B2G e Zero Trust (pre-condicao)');

step('operacao SPLIT_D0_AMORTIZACAO_LFT autorizada na whitelist do tenant', function () {
  operation = assertB2GOperationWhitelisted(WHITELABEL_TENANT, 'SPLIT_D0_AMORTIZACAO_LFT');
  assert.strictEqual(operation.settlementCycle, 'D-0', 'ciclo de liquidacao deve ser D-0');
});

step('titulo ' + ISIN + ' autorizado na whitelist de ativos do tenant', function () {
  assertBondWhitelisted(WHITELABEL_TENANT, ISIN);
});

step('token KYC/KYB invalido e rejeitado (negativo)', function () {
  assert.throws(function () {
    verifyZeroTrust({
      deviceSignature: 'LOWDATAESC-SIG-V2:' + randomBytes(32).toString('hex'),
      kycKybToken: 'KYC-KYB.V2.GOVBRCNPJ.1000000000',
      antifraudScore: 97
    });
  }, /kyc_kyb_token.validade/);
});

step('score antifraude abaixo do minimo e rejeitado (negativo)', function () {
  const op = operation as NonNullable<typeof operation>;
  assert.throws(function () {
    verifyZeroTrust({
      deviceSignature: 'LOWDATAESC-SIG-V2:' + randomBytes(32).toString('hex'),
      kycKybToken: 'KYC-KYB.V2.GOVBRCNPJ.' + (Math.floor(Date.now() / 1000) + 3600),
      antifraudScore: op.minAntifraudScore - 1
    });
  }, /antifraud_score/);
});

step('assinatura de dispositivo + KYC/KYB valido + score liberam o split', function () {
  const op = operation as NonNullable<typeof operation>;
  const verdict = verifyZeroTrust({
    deviceSignature: 'LOWDATAESC-SIG-V2:' + randomBytes(32).toString('hex'),
    kycKybToken: 'KYC-KYB.V2.GOVBRCNPJ.' + (Math.floor(Date.now() / 1000) + 3600),
    antifraudScore: 97
  });
  assert.strictEqual(verdict.approved, true, 'veredito Zero Trust deve ser aprovado');
  assert.strictEqual(verdict.checks.length, 3, 'devem ser verificados os 3 controles');
});

console.log('');
console.log('ETAPA 2 - Integridade matematica do split (bruto ' + formatBRL(GROSS_CENTS) + ')');

step('percentuais somam 100% (7500 + 1700 + 750 + 50 bps)', function () {
  assert.strictEqual(SPLIT_POLICY_BPS.netReceiverBps + SPLIT_POLICY_BPS.taxSplitBps + SPLIT_POLICY_BPS.debtAmortizationEscrowBps + SPLIT_POLICY_BPS.infraAuditFeeBps, 10000, 'soma em bps deve ser 10000');
});

step('split atomico sem perda de centavos', function () {
  split = computeSplit(GROSS_CENTS, SPLIT_POLICY_BPS);
  const a = split.allocation;
  assert.strictEqual(a.netReceiverAmount, 7500000, 'net_receiver_amount deve ser 75,0% (7500000)');
  assert.strictEqual(a.taxSplitAmount, 1700000, 'tax_split_amount deve ser 17,0% (1700000)');
  assert.strictEqual(a.debtAmortizationEscrow, 750000, 'debt_amortization_escrow deve ser 7,5% (750000)');
  assert.strictEqual(a.infraAuditFee, 50000, 'infra_audit_fee deve ser 0,5% (50000)');
  assert.strictEqual(a.netReceiverAmount + a.taxSplitAmount + a.debtAmortizationEscrow + a.infraAuditFee, GROSS_CENTS, 'soma das partes deve ser estritamente igual ao bruto');
  assert.strictEqual(split.exactMatch, true, 'exactMatch deve ser true');
});

console.log('');
console.log('ETAPA 3 - Liquidação escrow -> titulo publico (' + ISIN + ', PU ' + formatBRL(BOND_PU_CENTS) + ')');

step('custodia segregada (Camada 6) recebe saldo inicial da divida e o fundo escrow', function () {
  assert.ok(!!split, 'split deve ter sido calculado');
  const s = split as ReturnType<typeof computeSplit>;
  treasury = new EscrowTreasury();
  treasury.registerBond({ isin: ISIN, description: 'LFT Tesouro Selic - estoque custodiado do tenant', puCents: BOND_PU_CENTS }, INITIAL_DEBT_FRAC_PICO);
  treasury.openEscrowAccount('CAIXA_RECEBEDOR', 'Caixa liquido do recebedor');
  treasury.openEscrowAccount('RECEITA_TRIBUTARIA', 'Retencao tributaria direta');
  treasury.openEscrowAccount('FUNDO_AMORTIZACAO_DIVIDA', 'Fundo escrow de amortizacao da divida');
  treasury.openEscrowAccount('INFRA_AUDITORIA', 'Tarifa de infraestrutura e auditoria');
  treasury.deposit('CAIXA_RECEBEDOR', s.allocation.netReceiverAmount, 'segregacao split 75,0%');
  treasury.deposit('RECEITA_TRIBUTARIA', s.allocation.taxSplitAmount, 'segregacao split 17,0%');
  treasury.deposit('FUNDO_AMORTIZACAO_DIVIDA', s.allocation.debtAmortizationEscrow, 'segregacao split 7,5%');
  treasury.deposit('INFRA_AUDITORIA', s.allocation.infraAuditFee, 'segregacao split 0,5%');
  assert.strictEqual(treasury.getBalance('FUNDO_AMORTIZACAO_DIVIDA'), 750000, 'escrow de amortizacao deve deter 750000 centavos');
  assert.strictEqual(treasury.getDebtStockFracPico(ISIN), INITIAL_DEBT_FRAC_PICO, 'estoque da divida antes da baixa deve ser 4.000000');
});

step('conversao de ' + formatBRL(750000) + ' em baixa de 0.500000 de titulo e redução em tempo real', function () {
  const t = treasury as EscrowTreasury;
  order = t.amortizeDebt('FUNDO_AMORTIZACAO_DIVIDA', ISIN);
  assert.strictEqual(order.amountCents, 750000, 'valor liquidado deve ser 750000 centavos');
  assert.strictEqual(order.fractionPico, 500000, 'baixa deve ser de 0.500000 titulo');
  assert.strictEqual(order.debtRemainingFracPico, 3500000, 'estoque da divida deve cair para 3.500000 em tempo real');
  assert.strictEqual(t.getBalance('FUNDO_AMORTIZACAO_DIVIDA'), 0, 'escrow deve ser zerado apos liquidacao');
  assert.strictEqual(order.debtBeforeFracPico - order.debtRemainingFracPico, order.fractionPico, 'delta de divida deve ser igual as fracoes baixadas');
});

step('conversao imprecisa e bloqueada por trava de precisao (negativo)', function () {
  const t = treasury as EscrowTreasury;
  t.deposit('FUNDO_AMORTIZACAO_DIVIDA', 1, 'centavo residual de teste');
  assert.throws(function () {
    t.amortizeDebt('FUNDO_AMORTIZACAO_DIVIDA', ISIN);
  }, /ESCROW_PRECISION/);
});

console.log('');
console.log('ETAPA 4 - Prova criptográfica (trilha de auditoria encadeada)');

step('trilha encadeada SHA-256 verifica integralmente', function () {
  const trail = new AuditTrail('CHAIN-' + txId);
  trail.append('TX_OPENED', { txId: txId, grossCents: GROSS_CENTS, operation: (operation as NonNullable<typeof operation>).id, tenant: WHITELABEL_TENANT.tenantId });
  const s = split as ReturnType<typeof computeSplit>;
  trail.append('SPLIT_EXECUTADO', { txId: txId, allocation: s.allocation });
  const o = order as NonNullable<typeof order>;
  trail.append('AMORTIZACAO_PARCIAL_EXECUTADA', { txId: txId, isin: o.isin, fraction: o.fractionDecimal, amountCents: o.amountCents });
  const finalPayload = {
    txId: txId,
    allocation: s.allocation,
    amountsBRL: {
      netReceiver: formatBRL(s.allocation.netReceiverAmount),
      taxSplit: formatBRL(s.allocation.taxSplitAmount),
      debtAmortizationEscrow: formatBRL(s.allocation.debtAmortizationEscrow),
      infraAuditFee: formatBRL(s.allocation.infraAuditFee)
    },
    bond: { isin: o.isin, fraction: o.fractionDecimal, puCents: o.puCents },
    debtRemainingFracPico: o.debtRemainingFracPico
  };
  const chainHeadBeforeSeal = trail.lastHash;
  proof = trail.sealFinalPayload('PROOF_FINAL', finalPayload);
  assert.strictEqual(trail.verifyChain(), true, 'cadeia encadeada deve verificar');
  assert.ok(/^[0-9a-f]{64}$/.test(proof.recordHash), 'hash do selo deve ser SHA-256');
  const expectedProof = sha256Hex(sha256Hex(canonicalJson({ finalPayload: finalPayload, chainId: 'CHAIN-' + txId, chainHeadBeforeSeal: chainHeadBeforeSeal })) + chainHeadBeforeSeal);
  assert.strictEqual(proof.payload.proof, expectedProof, 'prova dupla SHA-256 deve casar com recalculo independente');
  assert.deepStrictEqual(JSON.parse(proof.payload.canonical as string), { finalPayload: finalPayload, chainId: 'CHAIN-' + txId, chainHeadBeforeSeal: chainHeadBeforeSeal }, 'payload selado deve conter o payload final');
  proofHash = proof.payload.proof;
});

step('relatorio terminal emitido com payload assinado', function () {
  const s = split as ReturnType<typeof computeSplit>;
  const o = order as NonNullable<typeof order>;
  console.log('');
  console.log('PROVA CRIPTOGRAFICA FINAL - payload assinado com SHA-256');
  console.log(canonicalJson({
    txId: txId,
    operation: (operation as NonNullable<typeof operation>).id,
    tenant: WHITELABEL_TENANT.tenantId,
    grossCents: GROSS_CENTS,
    allocation: s.allocation,
    bondPaid: { isin: o.isin, fraction: o.fractionDecimal, pu: formatBRL(o.puCents) },
    debtRemaining: formatFraction(o.debtRemainingFracPico),
    proof: proofHash
  }));
});

// ---------- ETAPA 5: camada de controle exata e dust (T13-T30) ----------

const FIXED_ISO = '2025-11-25T12:00:00.000Z';
const fixedEmitter = function (): string { return FIXED_ISO; };

function goodZeroTrust(): OperationRequest['zeroTrust'] {
  return {
    deviceSig: 'LOWDATAESC-SIG-V2:' + randomBytes(32).toString('hex'),
    kycToken: 'KYC-KYB.V2.GOVBRCNPJ.' + (Math.floor(Date.now() / 1000) + 3600),
    antifraudScore: 97
  };
}

function makeReq(overrides: Partial<OperationRequest>): OperationRequest {
  return {
    tenant: TENANT_GOVERNMENTAL_DEFAULT,
    operation: 'SPLIT_D0_AMORTIZACAO_LFT',
    isin: ISIN_DEFAULT,
    amountCents: assertCentsM(10000000),
    txId: 'TX-' + randomBytes(4).toString('hex').toUpperCase(),
    nonce: 'N-' + randomBytes(3).toString('hex'),
    zeroTrust: goodZeroTrust(),
    ...overrides
  };
}

let fuzzSeed = 4294965247;
function nextFuzz(): number {
  fuzzSeed = (fuzzSeed * 1664525 + 1013904223) % 4294967296;
  return fuzzSeed / 4294967296;
}

async function stepAsync(name: string, run: () => Promise<void> | void): Promise<void> {
  try {
    await run();
    passed++;
    console.log('  [OK] ' + name);
  } catch (err) {
    failures.push(name + ' -> ' + ((err as Error).message || String(err)));
    console.log('  [FALHA] ' + name);
  }
}

function sagaCtx(txId: string, gross: BrandCents): SplitAmortCtx {
  return {
    txId: txId, tenant: TENANT_GOVERNMENTAL_DEFAULT, isin: ISIN_DEFAULT, operation: 'SPLIT_D0_AMORTIZACAO_LFT',
    grossCents: gross, bps: [7500, 1700, 750, 50], escrowAccount: ESCROW_AMORT_ACCOUNT,
    policy: DUST_POLICY_DEFAULT, puCents: 1500000,
    buckets: [], amortBucket: 0 as BrandCents, escrowAfter: 0 as BrandCents, fractionMicro: 0 as BrandMicro,
    stockMicroBefore: 0, stockMicroAfter: 0, consumedCents: 0 as BrandCents, residualCents: 0 as BrandCents,
    dustApplied: 0 as BrandCents, seal: null
  };
}

async function runCamadaControle(): Promise<void> {
  console.log('');
  console.log('ETAPA 5 - Fuzz de conservacao de centavos (T13)');

  await stepAsync('T13 - fuzz 10.000 valores 1..1e10: I1-I3 em 100%', function () {
    for (let i = 0; i < 10000; i++) {
      const total = assertCentsM(1 + Math.floor(nextFuzz() * 1e10));
      const buckets = splitByBps(total, [7500, 1700, 750, 50]);
      let sum = 0;
      for (const b of buckets) {
        sum += b;
        if (!Number.isInteger(b) || b < 0) throw new Error('I2/I3 violada em ' + total);
      }
      if (sum !== total) throw new Error('I1 violada em ' + total);
    }
  });

  console.log('');
  console.log('ETAPA 6 - Dust de fracao e conservacao (T14)');

  await stepAsync('T14 - PU=1.333.333: dust de fracao registrado; dust + amortizado === pago (I7)', async function () {
    const stack = createDebtControlStack({ clock: fixedEmitter, pu: 1333333 });
    const res = await stack.engine.execute(makeReq({ txId: 'TX-T14', nonce: 'N-T14' }));
    if (!res.ok) throw new Error('engine recusou: ' + res.code);
    const fr = mulDivFloor(750000, 1000000, 1333333);
    const consumed = mulDivFloor(fr, 1333333, 1000000);
    if (res.fraction !== fr) throw new Error('fracao esperada ' + fr + ', obtida ' + res.fraction);
    if (res.dustApplied !== 750000 - consumed) throw new Error('dust esperado ' + (750000 - consumed) + ', obtido ' + res.dustApplied);
    if (stack.ledger.balance(ISIN_DEFAULT) !== res.dustApplied) throw new Error('ledger dust divergente');
    if (res.dustApplied + consumed !== 750000) throw new Error('I7 violada');
    if (stack.registry.stock(ISIN_DEFAULT) !== 4000000 - fr) throw new Error('estoque nao reduziu na casa certa');
  });

  console.log('');
  console.log('ETAPA 7 - Idempotencia duravel (T15-T17)');

  await stepAsync('T15 - idempotencia sequencial: 2 chamadas iguais -> estoque reduz 1x', async function () {
    const stack = createDebtControlStack({ clock: fixedEmitter });
    let effects = 0;
    const registry = stack.registry;
    stack.deps.amort = {
      pu: registry.pu.bind(registry),
      stock: registry.stock.bind(registry),
      rollback: registry.rollback.bind(registry),
      purchase: function (isin: string, amountCents: BrandCents) { effects++; return registry.purchase(isin, amountCents); }
    };
    const req = makeReq({ txId: 'TX-IDEM-SEQ', nonce: 'N-SEQ' });
    const r1 = await stack.engine.execute(req);
    const r2 = await stack.engine.execute(req);
    if (!r1.ok || r1.code !== EngineCode.OK) throw new Error('primeira chamada deveria executar: ' + r1.code);
    if (r2.code !== EngineCode.IDEMPOTENT_REPLAY) throw new Error('replay esperado IDEMPOTENT_REPLAY, obtido ' + r2.code);
    if (effects !== 1) throw new Error('contador de efeitos = ' + effects + ', esperado 1');
    if (stack.registry.stock(ISIN_DEFAULT) !== 3500000) throw new Error('estoque deveria reduzir exatamente 1x');
  });

  await stepAsync('T16 - idempotencia paralela: Promise.all -> contador de efeitos === 1', async function () {
    const stack = createDebtControlStack({ clock: fixedEmitter });
    let effects = 0;
    const registry = stack.registry;
    stack.deps.amort = {
      pu: registry.pu.bind(registry),
      stock: registry.stock.bind(registry),
      rollback: registry.rollback.bind(registry),
      purchase: function (isin: string, amountCents: BrandCents) { effects++; return registry.purchase(isin, amountCents); }
    };
    const req = makeReq({ txId: 'TX-IDEM-PAR', nonce: 'N-PAR' });
    const results = await Promise.all([stack.engine.execute(req), stack.engine.execute(req), stack.engine.execute(req)]);
    if (effects !== 1) throw new Error('contador de efeitos = ' + effects + ', esperado 1');
    const marks = results.map(function (r) { return JSON.stringify(r); });
    if (new Set(marks).size !== 1) throw new Error('resultados concorrentes divergentes');
    if (stack.registry.stock(ISIN_DEFAULT) !== 3500000) throw new Error('estoque deveria reduzir exatamente 1x');
  });

  await stepAsync('T17 - replay adversarial: payload alterado, key igual -> IDEMPOTENT_REPLAY', async function () {
    const stack = createDebtControlStack({ clock: fixedEmitter });
    const req = makeReq({ txId: 'TX-IDEM-ADV', nonce: 'N-ADV' });
    const r1 = await stack.engine.execute(req);
    if (!r1.ok) throw new Error('primeira execucao deveria passar');
    const adversarial = makeReq({ txId: 'TX-IDEM-ADV', nonce: 'N-ADV', zeroTrust: { deviceSig: 'garbage', kycToken: 'invalid', antifraudScore: -1 } });
    const r2 = await stack.engine.execute(adversarial);
    if (r2.code !== EngineCode.IDEMPOTENT_REPLAY) throw new Error('esperado IDEMPOTENT_REPLAY, obtido ' + r2.code);
    if (r2.txId !== req.txId) throw new Error('replay deveria devolver o mesmo txId');
    if (stack.registry.stock(ISIN_DEFAULT) !== 3500000) throw new Error('replay nao deveria causar efeito');
  });

  console.log('');
  console.log('ETAPA 8 - Atomicidade da saga com injecao de falha (T18-T19)');

  await stepAsync('T18 - falha no step 3 (amort.baixa) -> estado inicial restaurado + journal com pendencias', async function () {
    const stack = createDebtControlStack({ clock: fixedEmitter });
    const journal = new InMemoryJournal();
    const brokenAmort = {
      pu: stack.deps.amort.pu.bind(stack.deps.amort),
      stock: stack.deps.amort.stock.bind(stack.deps.amort),
      rollback: stack.deps.amort.rollback.bind(stack.deps.amort),
      purchase: function (): never { throw new InsufficientStock(ISIN_DEFAULT); }
    };
    const saga = buildSplitAmortSaga({
      split: stack.deps.split,
      escrow: stack.deps.escrow,
      amort: brokenAmort,
      audit: stack.deps.audit,
      dust: stack.deps.dust
    }, journal);
    const out = await saga.run(sagaCtx('TX-SAGA-1', assertCentsM(10000000)));
    if (out.ok) throw new Error('saga deveria falhar em amort.baixa');
    if (out.failedAt !== 'amort.baixa') throw new Error('ponto de falha inesperado: ' + out.failedAt);
    if (stack.treasury.getBalance(ESCROW_AMORT_ACCOUNT) !== 0) throw new Error('escrow deveria voltar ao estado inicial (0)');
    if (stack.registry.stock(ISIN_DEFAULT) !== 4000000) throw new Error('estoque deveria voltar ao estado inicial (4.000000)');
    const pend = journal.pending('TX-SAGA-1');
    if (pend.length === 0) throw new Error('journal deveria ter pendencias explicitas (sem orfao silencioso)');
    const labels = journal.all('TX-SAGA-1').map(function (e) { return e.step + ':' + e.phase; }).join(',');
    if (labels.indexOf('amort.baixa:FAIL') === -1) throw new Error('journal perdeu o FAIL: ' + labels);
    if (labels.indexOf('escrow.credit:UNDO') === -1) throw new Error('journal perdeu o UNDO do escrow: ' + labels);
  });

  await stepAsync('T19 - falha no step 6 (audit) -> baixa revertida e pendencia no journal', async function () {
    const stack = createDebtControlStack({ clock: fixedEmitter });
    const journal = new InMemoryJournal();
    const brokenAudit = {
      append: function (): never { throw new Error('AUDIT_DOWN'); },
      appendCompensation: stack.deps.audit.appendCompensation.bind(stack.deps.audit)
    };
    const saga = buildSplitAmortSaga({
      split: stack.deps.split,
      escrow: stack.deps.escrow,
      amort: stack.deps.amort,
      audit: brokenAudit,
      dust: stack.deps.dust
    }, journal);
    const out = await saga.run(sagaCtx('TX-SAGA-2', assertCentsM(10000000)));
    if (out.ok) throw new Error('saga deveria falhar em audit.append');
    if (out.failedAt !== 'audit.append') throw new Error('ponto de falha inesperado: ' + out.failedAt);
    if (stack.treasury.getBalance(ESCROW_AMORT_ACCOUNT) !== 0) throw new Error('escrow deveria voltar a zero');
    if (stack.registry.stock(ISIN_DEFAULT) !== 4000000) throw new Error('baixa deveria ser revertida');
    if (out.pending.length === 0) throw new Error('pendencia no journal esperada');
  });

  console.log('');
  console.log('ETAPA 9 - Canonicalizacao C1-C5 e ancora externa (T20-T24)');

  await stepAsync('T20 - ordem de chaves invertida -> MESMO hash (C1) + vetor de teste congelado', function () {
    const p1 = { a: 1, b: { x: 1, y: 2 } };
    const p2 = { b: { y: 2, x: 1 }, a: 1 };
    const h1 = hashRecord(GENESIS_HASH, p1);
    const h2 = hashRecord(GENESIS_HASH, p2);
    if (h1 !== h2) throw new Error('canonicalizacao instavel em ordem de chaves');
    const goldenCanonical = '{"amountCents":10000000,"bps":[7500,1700,750,50],"isin":"BRSTNCLF1RC4","op":"GOLDEN_VECTOR_V1","tenant":"GOV-BR-STN-01"}';
    const goldenHash = '0xca79069e7520156e5778bc039525a67efc8e363958d0180610567945cab71a38';
    const payload = { op: 'GOLDEN_VECTOR_V1', tenant: 'GOV-BR-STN-01', isin: 'BRSTNCLF1RC4', amountCents: 10000000, bps: [7500, 1700, 750, 50] };
    if (canonicalJsonV1(payload) !== goldenCanonical) throw new Error('canonical congelada divergiu');
    if (hashRecord(GENESIS_HASH, payload) !== goldenHash) throw new Error('golden hash divergiu');
  });

  await stepAsync('T21 - recomputacao cega do selo usando so C1-C5 -> identico', async function () {
    const stack = createDebtControlStack({ clock: fixedEmitter });
    const res = await stack.engine.execute(makeReq({ txId: 'TX-BLIND', nonce: 'N-BLIND' }));
    if (!res.ok) throw new Error('execucao falhou: ' + res.code);
    const records = stack.audit.getRecords();
    const last = records[records.length - 1];
    function blindCanonical(v: unknown): string {
      if (v === null) return 'null';
      if (typeof v === 'number') return String(v);
      if (typeof v === 'string') return JSON.stringify(v);
      if (typeof v === 'boolean') return v ? 'true' : 'false';
      if (Array.isArray(v)) return '[' + v.map(blindCanonical).join(',') + ']';
      const source = v as Record<string, unknown>;
      const keys = Object.keys(source).sort();
      const parts: string[] = [];
      for (const key of keys) {
        if (source[key] === undefined) continue;
        parts.push(JSON.stringify(key) + ':' + blindCanonical(source[key]));
      }
      return '{' + parts.join(',') + '}';
    }
    const crypto2 = require('node:crypto') as { createHash: (alg: string) => { update: (s: string, e: string) => { digest: (h: string) => string } } };
    const blindHash = '0x' + crypto2.createHash('sha256').update(last.prevHash + '\x00' + blindCanonical(last.payload), 'utf8').digest('hex');
    if (blindHash !== last.recordHash) throw new Error('recomputacao cega divergiu do selo da cadeia');
  });

  await stepAsync('T22 - tamper isolado: alterar evento n -> cadeia quebra no ponto certo', function () {
    const chain = new AuditChain({ clock: fixedEmitter });
    void chain.append('E1', { v: 1 }, 'TXA');
    const r2 = chain.append('E2', { v: 2 }, 'TXA');
    void chain.append('E3', { v: 3 }, 'TXA');
    const records = chain.getRecords().map(function (r) { return { prevHash: r.prevHash, payload: r.payload, recordHash: r.recordHash }; });
    if (!verifyCanonicalChain(records).ok) throw new Error('cadeia base deveria verificar');
    records[r2.sequence].recordHash = r2.recordHash.slice(0, -1).concat('0');
    const outcome = verifyCanonicalChain(records);
    if (outcome.ok) throw new Error('cadeia violada deveria quebrar');
    if (outcome.brokenAt !== r2.sequence) throw new Error('ponto de quebra errado: ' + String(outcome.brokenAt) + ' != ' + String(r2.sequence));
  });

  await stepAsync('T23 - reescrita total sem ancora valida -> assertAnchored lanca UNANCHORED_CHAIN', async function () {
    const stack = createDebtControlStack({ clock: fixedEmitter });
    const res = await stack.engine.execute(makeReq({ txId: 'TX-RW1', nonce: 'N-RW1' }));
    if (!res.ok || !res.seal) throw new Error('execucao base falhou');
    const sentinel = { anchorId: 'SENTINEL', chainHeadHash: GENESIS_HASH, chainHeadIndex: 0, anchoredAt: FIXED_ISO, anchorType: 'PUBLIC_CHAIN' as const, proof: 'x' };
    let threw = false;
    try {
      assertAnchored({ hash: res.seal.recordHash, index: 1 }, sentinel);
    } catch (err) {
      threw = err instanceof UnanchoredChain;
    }
    if (!threw) throw new Error('UNANCHORED_CHAIN esperado contra ancora sentinela');
  });

  await stepAsync('T24 - reescrita total COM ancora valida da cadeia original -> ancora detecta divergencia', async function () {
    const stack = createDebtControlStack({ clock: fixedEmitter });
    await stack.engine.execute(makeReq({ txId: 'TX-RW2', nonce: 'N-RW2' }));
    const head = stack.audit.head();
    const anchor = await stack.anchorBackend.publish(head);
    if (!(await stack.anchorBackend.verify(anchor))) throw new Error('anchor da cadeia original deveria verificar');
    const rewritten = stack.audit.getRecords().map(function (r) { return { prevHash: r.prevHash, payload: r.payload, recordHash: r.recordHash }; });
    rewritten[rewritten.length - 1].payload = { ...rewritten[rewritten.length - 1].payload };
    (rewritten[rewritten.length - 1].payload.data as Record<string, unknown>).grossCents = 999;
    let prev = rewritten[0].recordHash;
    for (let i = 1; i < rewritten.length; i++) {
      rewritten[i].prevHash = prev;
      rewritten[i].recordHash = hashRecord(prev, rewritten[i].payload);
      prev = rewritten[i].recordHash;
    }
    const outcome = verifyCanonicalChain(rewritten.map(function (r) { return { prevHash: r.prevHash, payload: r.payload, recordHash: r.recordHash }; }));
    if (!outcome.ok) throw new Error('cadeia reescrita deveria verificar internamente (hashes recomputados)');
    let threw = false;
    try {
      assertAnchored({ hash: prev, index: head.index }, anchor);
    } catch (err) {
      threw = err instanceof UnanchoredChain;
    }
    if (!threw) throw new Error('ancora deveria detectar a reescrita total');
  });

  console.log('');
  console.log('ETAPA 10 - Conciliacao diaria exata (T25-T26)');

  await stepAsync('T25 - conciliacao diaria integra -> reconcile ok (R1-R7)', async function () {
    const stack = createDebtControlStack({ clock: fixedEmitter });
    const ra = await stack.engine.execute(makeReq({ txId: 'TX-D1', nonce: 'N-D1' }));
    const rb = await stack.engine.execute(makeReq({ txId: 'TX-D2', nonce: 'N-D2' }));
    if (!ra.ok || !rb.ok || !ra.buckets || !rb.buckets) throw new Error('execucoes deveriam passar');
    const head = stack.audit.head();
    const anchor = await stack.anchorBackend.publish(head);
    const pago = ra.buckets[2] + rb.buckets[2];
    const dust = stack.ledger.balance(ISIN_DEFAULT);
    const amortizado = subCentsM(asBrandCents(pago), dust);
    const snapshot = {
      date: '2025-11-25', tenant: TENANT_GOVERNMENTAL_DEFAULT,
      estoqueInicialMicro: 4000000, estoqueFinalMicro: stack.registry.stock(ISIN_DEFAULT),
      totalAmortizadoMicro: (ra.fraction as number) + (rb.fraction as number),
      totalAmortizadoCents: amortizado,
      totalDustCents: dust, totalPagoAmortCents: asBrandCents(pago),
      eventsCount: head.index, chainHeadHash: head.hash, anchor: anchor
    };
    const rec = reconcile({ snapshot: snapshot, dustLedger: stack.ledger, auditChain: stack.audit, isins: [ISIN_DEFAULT] });
    if (!rec.ok) throw new Error('violacoes: ' + rec.violations.map(function (v) { return v.rule; }).join(','));
  });

  await stepAsync('T26 - conciliacao com gap de dia -> reconcile identifica R5', function () {
    const stack = createDebtControlStack({ clock: fixedEmitter });
    const head = stack.audit.head();
    const anchor = { anchorId: 'A', chainHeadHash: head.hash, chainHeadIndex: head.index, anchoredAt: FIXED_ISO, anchorType: 'PUBLIC_CHAIN' as const, proof: '' };
    const dust = stack.ledger.balance(ISIN_DEFAULT);
    const snapshot = {
      date: '2025-11-27', tenant: TENANT_GOVERNMENTAL_DEFAULT,
      estoqueInicialMicro: 4000000, estoqueFinalMicro: 4000000,
      totalAmortizadoMicro: 0, totalAmortizadoCents: 0 as BrandCents,
      totalDustCents: dust, totalPagoAmortCents: 0 as BrandCents,
      eventsCount: head.index, chainHeadHash: head.hash, anchor: anchor
    };
    const previous = { ...snapshot, date: '2025-11-25' };
    const rec = reconcile({ snapshot: snapshot, dustLedger: stack.ledger, auditChain: stack.audit, isins: [ISIN_DEFAULT], previousSnapshot: previous });
    if (rec.ok) throw new Error('gap deveria violar continuidade');
    if (!rec.violations.some(function (v) { return v.rule === 'R5'; })) throw new Error('R5 esperada: ' + rec.violations.map(function (v) { return v.rule; }).join(','));
  });

  console.log('');
  console.log('ETAPA 11 - Recusas, invariantes, bordas e determinismo (T27-T30)');

  await stepAsync('T27 - recusa BLOCKED_WHITELABEL registrada na cadeia com hash valido', async function () {
    const stack = createDebtControlStack({ clock: fixedEmitter });
    const res = await stack.engine.execute(makeReq({ txId: 'TX-BW', nonce: 'N-BW', operation: 'OPERACAO_FORA_DA_WHITELIST' }));
    if (res.ok || res.code !== EngineCode.BLOCKED_WHITELABEL) throw new Error('esperado BLOCKED_WHITELABEL, obtido ' + res.code);
    const rejections = stack.audit.getByTxId('TX-BW').filter(function (r) { return r.event === 'REJECTION'; });
    if (rejections.length !== 1) throw new Error('appendRejection ausente');
    if (!stack.audit.verify()) throw new Error('cadeia com recusa deveria verificar');
    if (stack.registry.stock(ISIN_DEFAULT) !== 4000000) throw new Error('nenhum efeito deveria ocorrer na recusa');
  });

  await stepAsync('T28 - invariantes I1-I8: caso OK e caso que dispara InvariantViolation com id correto', function () {
    function goodCtx(policy: DustPolicy): InvariantContext {
      return {
        bruto: assertCentsM(10000000),
        buckets: [7500000, 1700000, 750000, 50000] as BrandCents[],
        bucketAmort: assertCentsM(750000),
        puCents: 1500000,
        policy: policy,
        fracaoMicro: 500000 as BrandMicro,
        estoqueMicro: 4000000,
        escrowAfter: 0 as BrandCents,
        dustApplied: 0 as BrandCents,
        amortizadoCents: assertCentsM(750000),
        pagoAmortCents: assertCentsM(750000),
        auditChainVerifies: function () { return true; }
      };
    }
    const base = goodCtx(DUST_POLICY_DEFAULT);
    for (const r of checkAll(base)) {
      if (!r.ok) throw new Error('contexto integro deveria passar: ' + r.id);
    }
    assertAll(base);
    const cases: Array<[InvariantId, (c: InvariantContext) => void]> = [
      ['I1', function (c) { c.buckets = [7500000, 1700000, 750000, 49999] as BrandCents[]; }],
      ['I2', function (c) { c.buckets = [7500000.5, 1700000, 750000, 49999.5] as BrandCents[]; }],
      ['I3', function (c) { c.buckets = [7500000, 1700000, -750000, 1550000] as BrandCents[]; }],
      ['I4', function (c) { c.bucketAmort = assertCentsM(7); c.policy = { minFractionMicro: 1 as BrandMicro, onResidual: 'ACCUMULATE', onBelowMinFraction: 'RETURN_TO_ORIGIN' }; }],
      ['I5', function (c) { c.fracaoMicro = 4000001 as BrandMicro; }],
      ['I6', function (c) { c.escrowAfter = 1 as BrandCents; }],
      ['I7', function (c) { c.pagoAmortCents = assertCentsM(749999); }],
      ['I8', function (c) { c.auditChainVerifies = function () { return false; }; }]
    ];
    for (const pair of cases) {
      const id = pair[0];
      const mutate = pair[1];
      const ctx = goodCtx(DUST_POLICY_DEFAULT);
      mutate(ctx);
      let thrown: InvariantViolation | null = null;
      try { assertAll(ctx); } catch (err) { thrown = err as InvariantViolation; }
      if (!thrown) throw new Error(id + ' deveria violar');
      if (thrown.id !== id) throw new Error('id esperado ' + id + ', obtido ' + thrown.id);
    }
  });

  await stepAsync('T29 - bordas: bruto=0, bruto=1, PU=1, PU>bruto, estoque == fracao exata', async function () {
    const s1 = createDebtControlStack({ clock: fixedEmitter });
    const r1 = await s1.engine.execute(makeReq({ txId: 'TX-E0', nonce: 'E0', amountCents: assertCentsM(0) }));
    if (!r1.ok || r1.code !== EngineCode.OK) throw new Error('bruto=0 deveria ser aceito com buckets nulos: ' + r1.code);
    if (s1.ledger.balance(ISIN_DEFAULT) !== 0) throw new Error('bruto=0 nao deveria gerar dust');

    const s2 = createDebtControlStack({ clock: fixedEmitter });
    const r2 = await s2.engine.execute(makeReq({ txId: 'TX-E1', nonce: 'E1', amountCents: assertCentsM(1) }));
    if (!r2.ok) throw new Error('bruto=1 deveria executar: ' + r2.code);
    if (!r2.buckets || r2.buckets.reduce(function (a: number, b: number) { return a + b; }, 0) !== 1) throw new Error('bruto=1 deveria conservar 1 centavo');

    const s3 = createDebtControlStack({ clock: fixedEmitter, pu: 1, initialStockMicro: 1000000000000 });
    const r3 = await s3.engine.execute(makeReq({ txId: 'TX-E2', nonce: 'E2' }));
    if (!r3.ok) throw new Error('PU=1 deveria executar exato: ' + r3.code);
    if ((r3.fraction as number) !== 750000000000) throw new Error('PU=1: fracao deveria ser bucket x 1e6');
    if ((r3.dustApplied as number) !== 0) throw new Error('PU=1: conversao exata nao deveria gerar dust');

    const s4 = createDebtControlStack({ clock: fixedEmitter });
    const r4 = await s4.engine.execute(makeReq({ txId: 'TX-E3', nonce: 'E3', amountCents: assertCentsM(100) }));
    if (!r4.ok) throw new Error('PU>bruto deveria executar com dust: ' + r4.code);
    if ((r4.dustApplied as number) !== 1) throw new Error('PU>bruto: dust de 1 centavo esperado, obtido ' + String(r4.dustApplied));

    const s5 = createDebtControlStack({ clock: fixedEmitter, initialStockMicro: 500000 });
    const r5 = await s5.engine.execute(makeReq({ txId: 'TX-E4', nonce: 'E4' }));
    if (!r5.ok) throw new Error('estoque == fracao exata deveria executar: ' + r5.code);
    if (s5.registry.stock(ISIN_DEFAULT) !== 0) throw new Error('estoque deveria zerar exatamente');
  });

  await stepAsync('T30 - determinismo: mesma entrada -> mesmo selo (bit a bit) em 100 execucoes', async function () {
    let firstSeal = '';
    for (let i = 0; i < 100; i++) {
      const stack = createDebtControlStack({ clock: fixedEmitter });
      const res = await stack.engine.execute(makeReq({ txId: 'TX-DET-1', nonce: 'N-DET' }));
      if (!res.ok) throw new Error('execucao deterministica falhou: ' + res.code);
      const mark = JSON.stringify(res.seal) + '|' + canonicalJsonV1({ buckets: res.buckets, fraction: res.fraction, dustApplied: res.dustApplied });
      if (i === 0) firstSeal = mark;
      else if (mark !== firstSeal) throw new Error('selo divergiu na execucao ' + i);
    }
    if (firstSeal === '') throw new Error('selo vazio');
  });
}

function asBrandCents(v: number): BrandCents {
  return assertCentsM(v);
}

function printResumo(): void {
  console.log('');
  console.log('RESUMO');
  console.log('  Transacao..............: ' + txId);
  console.log('  Valor bruto............: ' + formatBRL(GROSS_CENTS));
  const a = (split as NonNullable<typeof split>).allocation;
  console.log('  ' + (SPLIT_POLICY_BPS.netReceiverBps / 100).toFixed(1).replace('.', ',') + '% Caixa liquido...: ' + formatBRL(a.netReceiverAmount));
  console.log('  ' + (SPLIT_POLICY_BPS.taxSplitBps / 100).toFixed(1).replace('.', ',') + '% Retencao........: ' + formatBRL(a.taxSplitAmount));
  console.log('  ' + (SPLIT_POLICY_BPS.debtAmortizationEscrowBps / 100).toFixed(2).replace('.', ',') + '% Fundo escrow..: ' + formatBRL(a.debtAmortizationEscrow) + ' -> ' + (order as NonNullable<typeof order>).fractionDecimal + ' x ' + ISIN);
  console.log('  ' + (SPLIT_POLICY_BPS.infraAuditFeeBps / 100).toFixed(1).replace('.', ',') + '% Infra/auditoria.: ' + formatBRL(a.infraAuditFee));
  console.log('  Divida remanescente.....: ' + formatFraction((order as NonNullable<typeof order>).debtRemainingFracPico) + ' (' + ISIN + ')');
  console.log('  Prova SHA-256...........: ' + proofHash);
  console.log('  ' + WHITELABEL_TENANT.brand.reportFooter);
  console.log('');
}

async function main(): Promise<void> {
  await runCamadaControle();
  printResumo();
  if (failures.length > 0) {
    console.error('VALIDACAO E2E FALHOU: ' + passed + ' ok, ' + failures.length + ' falha(s)');
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }
  console.log('VALIDACAO E2E COMPLETA: ' + passed + '/' + passed + ' validacoes OK, exit code 0');
}
main().catch(function (err) {
  console.error('VALIDACAO E2E CRASH: ' + ((err as Error).stack || String(err)));
  process.exit(1);
});
