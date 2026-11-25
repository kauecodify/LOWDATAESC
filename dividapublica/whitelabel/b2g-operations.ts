export type B2GOperationId =
  | 'SPLIT_D0_AMORTIZACAO_LFT'
  | 'RECOMPRA_COMPROMISSADA_LFT'
  | 'LIQUIDACAO_SELIC_D0'
  | 'BAIXA_FRACAO_TITULO';

export type B2GOperation = {
  id: B2GOperationId;
  label: string;
  settlementCycle: 'D-0';
  requiresZeroTrust: true;
  escrowMandatory: true;
  auditTrailMandatory: true;
  minAntifraudScore: number;
};

export type WhitelabelTenant = {
  tenantId: string;
  displayName: string;
  operatorScope: 'B2G';
  brand: {
    platformLabel: string;
    reportFooter: string;
  };
  allowedOperations: B2GOperationId[];
  bondsWhitelist: string[];
};

export const B2G_OPERATION_CATALOG: Record<B2GOperationId, B2GOperation> = {
  SPLIT_D0_AMORTIZACAO_LFT: {
    id: 'SPLIT_D0_AMORTIZACAO_LFT',
    label: 'Split Payment D-0 com amortizacao parcial de divida publica lastreada em LFT',
    settlementCycle: 'D-0',
    requiresZeroTrust: true,
    escrowMandatory: true,
    auditTrailMandatory: true,
    minAntifraudScore: 90
  },
  RECOMPRA_COMPROMISSADA_LFT: {
    id: 'RECOMPRA_COMPROMISSADA_LFT',
    label: 'Recompra compromissada de LFT com custodia segregada',
    settlementCycle: 'D-0',
    requiresZeroTrust: true,
    escrowMandatory: true,
    auditTrailMandatory: true,
    minAntifraudScore: 92
  },
  LIQUIDACAO_SELIC_D0: {
    id: 'LIQUIDACAO_SELIC_D0',
    label: 'Liquidacao de titulos publicos no ciclo D-0 (Tesouro Selic)',
    settlementCycle: 'D-0',
    requiresZeroTrust: true,
    escrowMandatory: true,
    auditTrailMandatory: true,
    minAntifraudScore: 90
  },
  BAIXA_FRACAO_TITULO: {
    id: 'BAIXA_FRACAO_TITULO',
    label: 'Baixa de fracoes de titulo publico via escritura do custodiante',
    settlementCycle: 'D-0',
    requiresZeroTrust: true,
    escrowMandatory: true,
    auditTrailMandatory: true,
    minAntifraudScore: 88
  }
};

export type WhitelistDeniedError = { code: 'WHITELIST_DENIED'; message: string };

// Whitelabel B2G: tenant padrao configurável por licenciado do produto.
export const WHITELABEL_TENANT: WhitelabelTenant = {
  tenantId: 'GOV-BR-STN-01',
  displayName: 'Secretaria do Tesouro Nacional (tenant whitelabel LOWDATAESC)',
  operatorScope: 'B2G',
  brand: {
    platformLabel: 'LOWDATAESC B2G',
    reportFooter: 'LOWDATAESC B2G - tenant GOV-BR-STN-01 - ambiente de simulação, sem efeitos no mercado'
  },
  allowedOperations: ['SPLIT_D0_AMORTIZACAO_LFT', 'BAIXA_FRACAO_TITULO'],
  bondsWhitelist: ['BRSTNCLF1RC4']
};

export function isOperationWhitelisted(tenant: WhitelabelTenant, operationId: B2GOperationId): boolean {
  return tenant.allowedOperations.indexOf(operationId) !== -1;
}

export function isBondWhitelisted(tenant: WhitelabelTenant, isin: string): boolean {
  return tenant.bondsWhitelist.indexOf(isin) !== -1;
}

export function assertB2GOperationWhitelisted(tenant: WhitelabelTenant, operationId: B2GOperationId): B2GOperation {
  if (!isOperationWhitelisted(tenant, operationId)) {
    throw new Error('[WHITELIST_DENIED] operacao ' + operationId + ' fora da whitelist B2G do tenant ' + tenant.tenantId);
  }
  const operation = B2G_OPERATION_CATALOG[operationId];
  if (!operation) {
    throw new Error('[WHITELIST_DENIED] operacao ' + operationId + ' inexistente no catalogo B2G');
  }
  if (!operation.requiresZeroTrust || !operation.escrowMandatory || !operation.auditTrailMandatory) {
    throw new Error('[WHITELIST_DENIED] operacao ' + operationId + ' sem travas obrigatorias (Zero Trust, escrow, auditoria)');
  }
  return operation;
}

export function assertBondWhitelisted(tenant: WhitelabelTenant, isin: string): void {
  if (!isBondWhitelisted(tenant, isin)) {
    throw new Error('[WHITELIST_DENIED] titulo ' + isin + ' fora da whitelist de ativos do tenant ' + tenant.tenantId);
  }
}
