import { SplitAllocation, SplitPolicyBps, SplitResult, ZeroTrustContext, ZeroTrustVerdict } from './types';

export const TOTAL_BPS = 10000;
export const MIN_ANTIFRAUD_SCORE = 90;

export const SPLIT_POLICY_BPS: SplitPolicyBps = {
  netReceiverBps: 7500,
  taxSplitBps: 1700,
  debtAmortizationEscrowBps: 750,
  infraAuditFeeBps: 50
};

export class ZeroTrustError extends Error {
  readonly check: string;
  constructor(check: string, message: string) {
    super('[ZERO_TRUST] ' + check + ': ' + message);
    this.name = 'ZeroTrustError';
    this.check = check;
  }
}

export function formatBRL(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const intPart = Math.floor(abs / 100);
  const fracPart = String(abs % 100).padStart(2, '0');
  const grouped = String(intPart).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return sign + 'R$ ' + grouped + ',' + fracPart;
}

export function formatFraction(fracPico: number): string {
  if (!Number.isInteger(fracPico) || fracPico < 0) {
    throw new Error('formatFraction: valor deve ser inteiro em micro-frações');
  }
  return (fracPico / 1000000).toFixed(6);
}

export function validatePolicy(policy: SplitPolicyBps): void {
  const sum = policy.netReceiverBps + policy.taxSplitBps + policy.debtAmortizationEscrowBps + policy.infraAuditFeeBps;
  if (sum !== TOTAL_BPS) {
    throw new Error('[POLICY_INVALID] soma dos percentuais ' + sum + ' bps difere de ' + TOTAL_BPS + ' bps');
  }
  for (const bps of [policy.netReceiverBps, policy.taxSplitBps, policy.debtAmortizationEscrowBps, policy.infraAuditFeeBps]) {
    if (!Number.isInteger(bps) || bps < 0) {
      throw new Error('[POLICY_INVALID] peso bps deve ser inteiro nao negativo');
    }
  }
}

// Alocacao por maior resto (largest remainder) em aritmética inteira de centavos.
// Garante soma estritamente igual a 100% do bruto, sem perda de centavos.
export function computeSplit(grossAmountCents: number, policy: SplitPolicyBps): SplitResult {
  if (!Number.isInteger(grossAmountCents) || grossAmountCents <= 0) {
    throw new Error('[POLICY_INVALID] valor bruto deve ser inteiro em centavos e maior que zero');
  }
  validatePolicy(policy);

  const weights = [
    ['netReceiverAmount', policy.netReceiverBps],
    ['taxSplitAmount', policy.taxSplitBps],
    ['debtAmortizationEscrow', policy.debtAmortizationEscrowBps],
    ['infraAuditFee', policy.infraAuditFeeBps]
  ] as Array<[keyof SplitAllocation, number]>;

  const ordered = weights.slice().sort((a, b) => b[1] - a[1]);
  const allocation: SplitAllocation = {
    netReceiverAmount: 0,
    taxSplitAmount: 0,
    debtAmortizationEscrow: 0,
    infraAuditFee: 0
  };

  let distributed = 0;
  for (const entry of ordered) {
    const base = Math.floor((grossAmountCents * entry[1]) / TOTAL_BPS);
    allocation[entry[0]] = base;
    distributed += base;
  }

  let remainder = grossAmountCents - distributed;
  for (const entry of ordered) {
    if (remainder === 0) break;
    allocation[entry[0]] += 1;
    remainder -= 1;
  }

  const total = allocation.netReceiverAmount + allocation.taxSplitAmount + allocation.debtAmortizationEscrow + allocation.infraAuditFee;
  return {
    grossAmountCents: grossAmountCents,
    policy: policy,
    allocation: allocation,
    exactMatch: total === grossAmountCents
  };
}

export function verifyZeroTrust(ctx: ZeroTrustContext, minAntifraudScore: number = MIN_ANTIFRAUD_SCORE): ZeroTrustVerdict {
  const now = Math.floor(Date.now() / 1000);
  let verdict: ZeroTrustVerdict = { approved: true, checks: [] };

  const fail = (check: string, message: string): never => {
    throw new ZeroTrustError(check, message);
  };

  const deviceOk =
    typeof ctx.deviceSignature === 'string' &&
    ctx.deviceSignature.startsWith('LOWDATAESC-SIG-V2:') &&
    /^[0-9a-f]{32,64}$/.test(ctx.deviceSignature.slice('LOWDATAESC-SIG-V2:'.length));

  verdict.checks.push({ name: 'device_signature.cama_2', passed: deviceOk });
  if (!deviceOk) fail('device_signature.cama_2', 'assinatura do dispositivo ausente, malformada ou fora da lista confiavel');

  const tokenParts = (typeof ctx.kycKybToken === 'string' ? ctx.kycKybToken : '').split('.');
  const tokenShapeOk = tokenParts.length === 4 && tokenParts[0] === 'KYC-KYB' && tokenParts[1] === 'V2' && /^[A-Z0-9-]{4,64}$/.test(tokenParts[2]) && /^\d{10,13}$/.test(tokenParts[3]);
  const tokenExpOk = tokenShapeOk && parseInt(tokenParts[3], 10) > now;

  verdict.checks.push({ name: 'kyc_kyb_token.validade', passed: tokenExpOk });
  if (!tokenExpOk) fail('kyc_kyb_token.validade', 'token KYC/KYB invalido ou expirado');

  const scoreOk = Number.isInteger(ctx.antifraudScore) && ctx.antifraudScore >= minAntifraudScore && ctx.antifraudScore <= 100;
  verdict.checks.push({ name: 'antifraud_score.camada_5', passed: scoreOk });
  if (!scoreOk) fail('antifraud_score.camada_5', 'score antifraude ' + ctx.antifraudScore + ' abaixo do minimo ' + minAntifraudScore);

  return verdict;
}
