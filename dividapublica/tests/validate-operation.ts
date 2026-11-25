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

console.log('');
console.log('RESUMO');
console.log('  Transacao..............: ' + txId);
console.log('  Valor bruto............: ' + formatBRL(GROSS_CENTS));
const a = (split as ReturnType<typeof computeSplit>).allocation;
console.log('  ' + (SPLIT_POLICY_BPS.netReceiverBps / 100).toFixed(1).replace('.', ',') + '% Caixa liquido...: ' + formatBRL(a.netReceiverAmount));
console.log('  ' + (SPLIT_POLICY_BPS.taxSplitBps / 100).toFixed(1).replace('.', ',') + '% Retencao........: ' + formatBRL(a.taxSplitAmount));
console.log('  ' + (SPLIT_POLICY_BPS.debtAmortizationEscrowBps / 100).toFixed(2).replace('.', ',') + '% Fundo escrow..: ' + formatBRL(a.debtAmortizationEscrow) + ' -> ' + (order as NonNullable<typeof order>).fractionDecimal + ' x ' + ISIN);
console.log('  ' + (SPLIT_POLICY_BPS.infraAuditFeeBps / 100).toFixed(1).replace('.', ',') + '% Infra/auditoria.: ' + formatBRL(a.infraAuditFee));
console.log('  Divis remanescente......: ' + formatFraction((order as NonNullable<typeof order>).debtRemainingFracPico) + ' (' + ISIN + ')');
console.log('  Prova SHA-256...........: ' + proofHash);
console.log('  ' + WHITELABEL_TENANT.brand.reportFooter);
console.log('');

if (failures.length > 0) {
  console.error('VALIDACAO E2E FALHOU: ' + passed + ' ok, ' + failures.length + ' falha(s)');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('VALIDACAO E2E COMPLETA: ' + passed + '/' + passed + ' validacoes OK, exit code 0');
