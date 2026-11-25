# dividapublica

Modulo de validacao do **Split Payment com Amortizacao Parcial da Divida Publica em Tempo Real lastreada em Titulos Publicos** (fluxo D-0), integrado as camadas de seguranca Zero Trust da LOWDATAESC. TypeScript puro, sem dependencias de npm: apenas `node:crypto` e `node:assert`.

## Arquitetura

O modulo consome as camadas de seguranca do repositorio e adiciona a semantica de liquidacao B2G:

| Camada | Componente no modulo | Papel |
| --- | --- | --- |
| Camada 2 (Dispositivo) | `src/split-engine.ts` (`verifyZeroTrust`) | Assinatura criptografica do dispositivo validada antes de qualquer split |
| Camada 1/4 (Identidade e tokens) | `src/split-engine.ts` (`verifyZeroTrust`) | Token KYC/KYB com prazo de validade verificado |
| Camada 5 (Antifraude) | `src/split-engine.ts` (`verifyZeroTrust`) | Score antifraude minimo de 90/100 |
| Whitelabel B2G | `whitelabel/b2g-operations.ts` | Whitelist declarativa de operacoes e ISINs por tenant |
| Camada 6 (Escrow) | `src/escrow-treasury.ts` | Custodia segregada com razao de lancamentos debit/credit |
| Liquidacao D-0 | `src/escrow-treasury.ts` (`amortizeDebt`) | Conversao do fundo escrow em baixa de fracoes de titulo publico |
| Compliance | `src/audit-trail.ts` | Trilha imutavel encadeada (SHA-256), BCB / TCU / LGPD art. 37 |

### Aritmetica de precisao

Todos os valores operam em **inteiros de centavos**. Os percentuais do split sao expressos em basis points (bps) e a alocacao usa o metodo do **maior resto** (largest remainder), o que elimina perda ou ganho de centavos por arredondamento:

| Parcela | Percentual | Campo | bps |
| --- | --- | --- | --- |
| Caixa liquido do recebedor | 75,0% | `net_receiver_amount` | 7500 |
| retencao tributaria direta | 17,0% | `tax_split_amount` | 1700 |
| Fundo escrow de amortizacao da divida | 7,5% | `debt_amortization_escrow` | 750 |
| Tarifa de infraestrutura e auditoria | 0,5% | `infra_audit_fee` | 50 |
| **Total** | **100,0%** | - | **10000** |

A fracao de titulo opera em micro-fracoes inteiras (`FRACTION_SCALE = 1000000` por unidade): `0.500000` de titulo e representado internamente como `500000` micro-fracoes, mantendo a divisao exata `750000 centavos / 1500000 centavos de PU`.

## Fluxo de liquidacao (D-0)

1. **Whitelabel B2G**: a operacao e o ISIN sao verificados contra a whitelist do tenant (`assertB2GOperationWhitelisted`, `assertBondWhitelisted`). Nao autorizado: bloqueio imediato.
2. **Zero Trust (pre-condicao)**: assinatura `LOWDATAESC-SIG-V2:<hex>` do dispositivo registrado, token `KYC-KYB.V2.<entidade>.<expiracao>` vigente e score antifraude >= 90. Falha em qualquer controle aborta a operacao sem movimentar saldo.
3. **Split atomico**: valor bruto em centavos e segregado por maior resto; a soma das quatro partes e re-verificada contra o bruto (`exactMatch`). Qualquer residuo bloqueia.
4. **Escrow segregado (Camada 6)**: cada parcela entra em conta segregada com lancamento no razao (`CAIXA_RECEBEDOR`, `RECEITA_TRIBUTARIA`, `FUNDO_AMORTIZACAO_DIVIDA`, `INFRA_AUDITORIA`).
5. **Amortizacao em tempo real**: o saldo do `FUNDO_AMORTIZACAO_DIVIDA` e integralmente convertido em micro-fracoes do titulo (ex.: `ISIN BRSTNCLF1RC4`, PU R$ 15.000,00), com trava de precisao (`ESCROW_PRECISION`) quando a divisao nao e exata. O estoque da divida e reduzido no mesmo instante e a conta escrow e zerada.
6. **Prova criptografica**: cada evento gera registro com `previousHash`/`recordHash` (SHA-256 encadeado, serializacao canonica por chaves ordenadas). O selo final concentra id da transacao, valores segregados, ISIN abatido e saldo remanescente, com prova dupla SHA-256.

## Estrutura

```
dividapublica/
  README.md
  src/
    types.ts            # tipos compartilhados
    split-engine.ts     # split em centavos + travas Zero Trust
    escrow-treasury.ts  # custodia segregada e baixa de titulos (Camada 6)
    audit-trail.ts      # trilha imutavel SHA-256 encadeada
  whitelabel/
    b2g-operations.ts   # catalogo B2G e tenant whitelabel
    README.md
  tests/
    validate-operation.ts  # E2E: R$ 100.000,00, exit 0/1
```

## Manual de instalacao

Pre-requisito unico: **Node.js 18 ou superior** (recomendado 22 LTS).
O codigo do modulo nao tem dependencias de runtime; o `package.json` da raiz fixa apenas a toolchain de execucao (`ts-node 10.9.2`, `typescript 5.8.3`, `@types/node`), pois versoes do TypeScript >= 5.9 sao incompativeis com o ts-node 10.9.2.

### Ubuntu / macOS

1. Instale o Node.js:
   - Ubuntu: `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs`
   - macOS: `brew install node@22` (ou instale pelo pacote oficial em nodejs.org).
2. Clone o repositorio e acesse sua raiz: `cd LOWDATAESC`.
3. Verifique a versao: `node --version` (>= v18).
4. Instale a toolchain fixada (unico passo de setup): `npm install`.
5. Execute o teste de validacao: `npx ts-node dividapublica/tests/validate-operation.ts` (ou `npm run validate:dividapublica`).

### Windows

1. Instale Node.js 22 pelo instalador em nodejs.org.
2. Abra o PowerShell na raiz do repositorio.
3. Verifique a versao: `node --version` (>= v18).
4. Instale a toolchain fixada (unico passo de setup): `npm install`.
5. Execute o teste de validacao: `npx ts-node dividapublica/tests/validate-operation.ts` (ou `npm run validate:dividapublica`).

### Resultado esperado

- Trinta validacoes (T1-T30), `exit code 0` e a linha final `VALIDACAO E2E COMPLETA: 30/30 validacoes OK, exit code 0`.
- Prova SHA-256 final impressa no terminal com id da transacao, valores segregados, ISIN abatido e divida remanescente.
- Qualquer falha de trava (Zero Trust, boundary matematico, precisao de fracao, whitelist) imprime `VALIDACAO E2E FALHOU` com o motivo e retorna `exit code 1`.

### Uso como biblioteca

```ts
import { computeSplit, SPLIT_POLICY_BPS, verifyZeroTrust } from './dividapublica/src/split-engine';
import { EscrowTreasury } from './dividapublica/src/escrow-treasury';
import { AuditTrail } from './dividapublica/src/audit-trail';

const split = computeSplit(10000000, SPLIT_POLICY_BPS); // R$ 100.000,00 em centavos
const treasury = new EscrowTreasury();
const order = treasury.amortizeDebt('FUNDO_AMORTIZACAO_DIVIDA', 'BRSTNCLF1RC4');
const trail = new AuditTrail('CHAIN-TX-1');
trail.sealFinalPayload('PROOF_FINAL', { result: split });
```

## Camada de controle exata e dust

Camada adicional (`src/money.ts`, `src/dust.ts`, `src/invariants.ts`, `src/idempotency.ts`, `src/canonical.ts`, `src/anchor.ts`, `src/saga.ts`, `src/reconcile.ts`, `src/audit-chain.ts`, `src/engine.ts`, `src/factory.ts`) que formaliza conservacao de centavos, atomicidade transacional e prova criptografica anti-reescrita. Toda a aritmetica monetaria e inteira (centavos) e toda fracao e inteira em micro fracoes (1e-6); nenhum float e usado em valor monetario ou fracao.

### Invariantes I1-I8

| Id | Invariante |
|----|------------|
| I1 | Σ buckets === valor bruto (conservacao do split) |
| I2 | todo bucket e inteiro |
| I3 | todo bucket e nao-negativo |
| I4 | `bucketAmort * 1e6 % puCents === 0`, ou `policy.onBelowMinFraction === 'ACCUMULATE'` |
| I5 | `fracaoMicro <= estoqueMicro` (estoque suficiente) |
| I6 | escrow zerado apos a baixa do titulo |
| I7 | `dustApplied + amortizadoCents === pagoAmortCents` (conservacao do dust) |
| I8 | cadeia de auditoria canonica verifica integralmente |

### Politica de dust (`DustPolicy`)

O ledger de dust e contabil, em dupla entrada, por `(tenant, ISIN)`: cada evento gera lancamentos `CREDIT`/`DEBIT` encadeados por hash, com invariantes `balance(isin) === Σ creditos − Σ debitos` e `balance(isin) >= 0` provaveis a partir de `history()`.

- `minFractionMicro`: menor fracao aceitavel (default `1`, ou seja 0.000001 de titulo).
- `onResidual: 'FAIL' | 'ACCUMULATE'`: o que fazer se o split deixar residuo (nunca deve ocorrer com maior resto deterministico).
- `onBelowMinFraction: 'ACCUMULATE' | 'RETURN_TO_ORIGIN'`: dust de fracao (truncamento em `PU` nao divisivel) e acumulado no ledger ou devolvido a origem.
- Exemplos: `PU = 1.333.333` centavos e bucket de 750.000 centavos gera fracao `5625` micro (`0.005625`), consumindo `7.499` centavos e retendo `1` centavo de dust (`FRACTION_TRUNCATION`); `PU > bruto` gera dust de `1` centavo com fracao truncada a 4 micro; `PU = 1` centavo com estoque `1e12` micro nao gera dust algum.

### Canonicalizacao e ancora

- `CANON_VERSION = 'v1'` e `GENESIS_HASH = 0x0000000000000000000000000000000000000000000000000000000000000000` sao constantes publicadas (fonte: `src/canonical.ts`).
- Regras C1-C5: chaves em ordem lexicografica em todos os niveis, apenas inteiros para dinheiro/fracao, UTF-8 sem espacos, separador `prevHash ‖ payload = 0x00`, genesis verificado no bootstrap.
- Golden vector congelado: `hashRecord(GENESIS_HASH, {"amountCents":10000000,"bps":[7500,1700,750,50],"isin":"BRSTNCLF1RC4","op":"GOLDEN_VECTOR_V1","tenant":"GOV-BR-STN-01"}) = 0xca79069e7520156e5778bc039525a67efc8e363958d0180610567945cab71a38`.
- Anti-reescrita total: `assertAnchored` compara a cabeca da cadeia contra a `Anchor` publicada (`InMemoryAnchor`/`HsmAnchorStub`); reescrita integral com hashes recomputeados verifica internamente, mas nunca bate com a ancora externa.

### Codigo do motor (`EngineCode`)

`OK`, `BLOCKED_WHITELABEL`, `ABORTED_ZERO_TRUST`, `ESCROW_PRECISION`, `INSUFFICIENT_STOCK`, `AUDIT_CHAIN_BROKEN`, `DUST_INSUFFICIENT`, `INVARIANT_VIOLATION`, `IDEMPOTENT_REPLAY`, `UNANCHORED_CHAIN`, `NON_INTEGER_CENTS`, `NON_INTEGER_MICRO`, `NEGATIVE_BALANCE`, `INVALID_BPS_SUM`, `SAGA_STEP_FAILED`. Toda recusa e registrada na cadeia via `appendRejection` (regra R6).

### Como executar os testes

```bash
npx tsc --noEmit -p tsconfig.json                    # AC1: 0 erros (strict)
npx ts-node dividapublica/tests/validate-operation.ts # T1-T30 (npm run validate:dividapublica)
npx ts-node dividapublica/tests/money.test.ts        # fuzz 10.000/10.000 (npm run test:money)
npx ts-node dividapublica/tests/dust.test.ts         # conservacao 1.000/1.000 (npm run test:dust)
```

## Compliance

- **BCB**: trilha auditavel de todas as movimentacoes (Res. 3.638/13 art. 5 - documentos e trilhas de auditoria).
- **TCU**: rastreabilidade integral das baixas de divida publica via cadeia encadeada verificavel (`verifyChain`).
- **LGPD**: trilha registrada minimamente (ids, valores, eventos tecnicos), sem dados pessoais no payload do produto.
- Ambiente de simulacao: os titulos (ISIN/PU) e o estoque da divida sao mocks para validacao de motor e travas; nenhuma integracao real com Selic ou STN e executada.
