# Whitelabel B2G

Whitelabel das operacoes B2G (Business-to-Government) da LOWDATAESC aplicadas ao modulo `dividapublica`. Define o tenant, a marca e a whitelist de operacoes e de titulos publicos autorizados.

## Conteudo

- `b2g-operations.ts`: catalogo de operacoes B2G (`B2G_OPERATION_CATALOG`), tenant whitelabel (`WHITELABEL_TENANT`) e travas `assertB2GOperationWhitelisted` / `assertBondWhitelisted`.

## Operacoes B2G whitelabel

| Operacao | Ciclo | Travas obrigatorias |
| --- | --- | --- |
| `SPLIT_D0_AMORTIZACAO_LFT` | D-0 | Zero Trust, escrow, trilha de auditoria |
| `RECOMPRA_COMPROMISSADA_LFT` | D-0 | Zero Trust, escrow, trilha de auditoria |
| `LIQUIDACAO_SELIC_D0` | D-0 | Zero Trust, escrow, trilha de auditoria |
| `BAIXA_FRACAO_TITULO` | D-0 | Zero Trust, escrow, trilha de auditoria |

Toda operacao do catalogo e executada apenas se: estiver na whitelist do tenant, o ISIN estiver na whitelist de ativos, as travas de Zero Trust, escrow segregado e trilha de auditoria estiverem ativas.

## Personalizacao do tenant

Edite `WHITELABEL_TENANT` em `b2g-operations.ts`:

- `tenantId` e `displayName`: identificacao institucional do operador.
- `brand.platformLabel` e `brand.reportFooter`: marca exibida no terminal e nos relatorios.
- `allowedOperations`: operacoes whitelabel autorizadas para o tenant.
- `bondsWhitelist`: codigos ISIN de titulos custodiados autorizados.

Nenhuma alteracao no motor de split e necessaria para licenciar a marca; a whitelist e declarativa.

## Manual de instalacao

1. Instale Node.js 18 ou superior (Ubuntu/macOS: verifique `node --version`; Windows: use o instalador em nodejs.org).
2. Na raiz do repositorio, instale a toolchain fixada (unico passo de setup): `npm install`.
3. Execute a validacao: `npx ts-node dividapublica/tests/validate-operation.ts` (ou `npm run validate:dividapublica`).
4. Verifique no relatorio final a marca do tenant (`LOWDATAESC B2G - tenant GOV-BR-STN-01`) e a operacao whitelabel `SPLIT_D0_AMORTIZACAO_LFT` autorizada.

O codigo do modulo nao tem dependencias de npm; o `package.json` da raiz fixa apenas `ts-node` e `typescript`.

## Validacao whitelabel coberta pelo E2E

- `WHITELIST_OK`: operacao e ISIN autorizados na whitelist do tenant.
- `WHITELIST_DENIED`: operacao, ISIN ou travas fora da whitelist bloqueiam antes de qualquer movimentacao.
