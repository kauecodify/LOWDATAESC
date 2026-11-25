export type SplitPolicyBps = {
  netReceiverBps: number;
  taxSplitBps: number;
  debtAmortizationEscrowBps: number;
  infraAuditFeeBps: number;
};

export type SplitAllocation = {
  netReceiverAmount: number;
  taxSplitAmount: number;
  debtAmortizationEscrow: number;
  infraAuditFee: number;
};

export type SplitResult = {
  grossAmountCents: number;
  policy: SplitPolicyBps;
  allocation: SplitAllocation;
  exactMatch: boolean;
};

export type ZeroTrustContext = {
  deviceSignature: string;
  kycKybToken: string;
  antifraudScore: number;
};

export type ZeroTrustVerdict = {
  approved: boolean;
  checks: Array<{ name: string; passed: boolean }>;
};

export type TreasuryBond = {
  isin: string;
  description: string;
  puCents: number;
  stockFracPico?: number;
};

export type DebtReductionOrder = {
  orderType: 'AMORTIZACAO_PARCIAL';
  isin: string;
  amountCents: number;
  puCents: number;
  fractionPico: number;
  fractionDecimal: string;
  debtBeforeFracPico: number;
  debtRemainingFracPico: number;
  escrowAccount: string;
};

export type ErrCode = 'ZERO_TRUST_FAILED' | 'POLICY_INVALID' | 'ESCROW_PRECISION' | 'ESCROW_BALANCE' | 'BOND_STOCK' | 'WHITELIST_DENIED';

export type AuditRecord = {
  sequence: number;
  timestamp: string;
  event: string;
  payload: Record<string, unknown>;
  previousHash: string;
  recordHash: string;
};
