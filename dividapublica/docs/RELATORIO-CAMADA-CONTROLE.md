# Relatorio de aceitacao - Camada de controle exata e dust (AC12)

Escopo: fechamento dos itens 1 a 12 do checklist da Parte III do Manual de Funcionamento e Protocolo de Analise v1.0, sobre o modulo `dividapublica/`. O item 13 (integracao real) permanece aberto por decisao explicita de escopo.

## 1. Arquivos criados

| Arquivo | Conteudo |
|---------|----------|
| `dividapublica/src/money.ts` | Tipos marcados `Cents`/`MicroFraction`, `assertCents`, `assertMicro`, `addCents`, `subCents`, `mulDivFloor` (BigInt interno), `mulMod`, `splitByBps` (maior resto, empate por indice ASC). |
| `dividapublica/src/dust.ts` | Ledger de dust em dupla entrada por `(tenant, ISIN)`, entradas `CREDIT`/`DEBIT` encadeadas por hash, `DustPolicy`, `computeResidual`, `applyDustPolicy`, `InsufficientDust`, ULID Crockford. |
| `dividapublica/src/invariants.ts` | Invariantes I1-I8 como funcoes puras, `checkAll`, `assertAll`, classe `InvariantViolation { id }`. |
| `dividapublica/src/idempotency.ts` | `IdempotencyStore` (interface para backend duravel) + `InMemoryIdempotencyStore` (putIfAbsent atomico, TTL 24h), `withIdempotency` com deduplicacao de execucoes concorrentes. |
| `dividapublica/src/canonical.ts` | `CANON_VERSION = 'v1'`, `GENESIS_HASH` (64 zeros), `canonicalJson` (C1-C5), `hashRecord` (`sha256(prevHash + 0x00 + canonical)`), `verifyChain`. |
| `dividapublica/src/anchor.ts` | `Anchor`, `AnchorBackend`, `InMemoryAnchor`, `HsmAnchorStub` (HMAC-SHA256), `assertAnchored`, `UnanchoredChain`. |
| `dividapublica/src/saga.ts` | `SagaStep<C>`, `Saga<C>` com journal (DO/OK/FAIL/UNDO, pendencias explicitas), `buildSplitAmortSaga` com os 6 passos canonico e undo em ordem inversa. |
| `dividapublica/src/reconcile.ts` | `DailySnapshot`, `reconcile` com as sete regras R1-R7 e `ReconcileViolation` tipada. |
| `dividapublica/src/audit-chain.ts` | Novo `AuditChain` (aditivo; o `audit-trail.ts` legado intacto): genesis, `append`, `appendRejection`, `appendDust`, `appendCompensation`, `head`, `verify`, `verifyFrom`, `getByTxId`, `recordsForDate`, usando `canonical.hashRecord`. |
| `dividapublica/src/engine.ts` | `DebtControlEngine` (pipeline whitelabel -> zeroTrust -> idempotencia -> saga -> assertAll(I1-I8) -> resultado), `EngineCode` (15 codigos), `OperationRequest`/`OperationResult`. |
| `dividapublica/src/factory.ts` | `createDebtControlStack` monta stack completa (engine, treasury, registry de estoque, ledger, audit, idempotencia, ancora) com `DUST_POLICY_DEFAULT` e tenant `GOV-BR-STN-01`. |
| `dividapublica/tests/money.test.ts` | 7 checagens, fuzz LCG 10.000/10.000 valores 1..1e10, bordas 0/1/999999, empates, `InvalidBpsSum`, overflow. |
| `dividapublica/tests/dust.test.ts` | 6 checagens, conservacao em 1.000/1.000 operacoes, encadeamento, `InsufficientDust`, truncamento com PU = 1.333.333. |
| `dividapublica/docs/RELATORIO-CAMADA-CONTROLE.md` | Este relatorio. |

## 2. Arquivos estendidos

- `dividapublica/tests/validate-operation.ts`: mantidas intactas as 12 validacoes originais (T1-T12) e adicionados T13-T30 (camada de controle exata).
- `dividapublica/README.md`: secao "Camada de controle exata e dust" (tabela I1-I8, `DustPolicy`, genesis/version publicados, `EngineCode`, comandos).
- `dividapublica/whitelabel/README.md`: dust isolado por `(tenant, ISIN)`.
- `README.md` (raiz): checklist Parte III com status por item e contagem 30/30.
- `package.json` (raiz): scripts `test:money` e `test:dust`.

## 3. Testes adicionados (T13-T30)

- T13 fuzz 10.000: I1-I3 em 100% dos casos.
- T14 PU = 1.333.333: dust de fracao registrado (`FRACTION_TRUNCATION`), `dust + amortizado === pago` (I7).
- T15 idempotencia sequencial: 2 chamadas, 1 execucao (estoque 4.000.000 -> 3.500.000 micro, exatamente 1x).
- T16 idempotencia paralela: `Promise.all` x3, contador de efeitos = 1, resultados identicos.
- T17 replay adversarial: mesma `(txId, nonce)` com zero-trust corrompido -> `IDEMPOTENT_REPLAY`, nenhum efeito.
- T18 falha no passo `amort.baixa`: escrow 0, estoque restaurado, journal com `amort.baixa:FAIL` e `escrow.credit:UNDO`.
- T19 falha no passo `audit.append`: baixa revertida e pendencia registrada (sem orfao silencioso).
- T20 ordem de chaves invertida -> mesmo hash (C1); golden vector congelado.
- T21 recomputacao cega do selo com SHA-256 independente -> identico.
- T22 tamper isolado: `verifyChain` quebra exatamente no evento alterado.
- T23 reescrita contra ancora sentinela -> `UnanchoredChain`.
- T24 reescrita total com hashes recomputados verifica internamente, mas `assertAnchored` detecta contra a ancora da cadeia original.
- T25 conciliacao integra -> `reconcile.ok` (R1-R7).
- T26 gap de data -> violacao R5 especifica.
- T27 recusa `BLOCKED_WHITELABEL` registrada via `appendRejection`, cadeia integra, estoque intocado.
- T28 I1-I8 com caso OK e caso de violacao para cada invariante (cada `throw` com `id` correto).
- T29 bordas: bruto 0 (ok, sem dust), bruto 1 (conserva 1), PU 1 com estoque 1e12 micro (sem dust), PU > bruto (dust 1, fracao 4), estoque == fracao exata (estoque 0).
- T30 determinismo: 100 stacks novas com clock fixo -> selo bit a bit identico.

## 4. Invariantes cobertas

I1-I8 formalizadas e provadas por teste positivo e negativo (T28, `money.test.ts`, `dust.test.ts`); conservacao de dust (I7) e conservacao global (R2) checadas em execução normal, borda e falha.

## 5. Criterios de aceitacao

| Criterio | Resultado |
|----------|-----------|
| AC1 `npx tsc --noEmit -p tsconfig.json` (strict) | 0 erros |
| AC2 E2E `validate-operation.ts` | `VALIDACAO E2E COMPLETA: 30/30 validacoes OK, exit code 0` |
| AC3 sem `any`, sem `as unknown as`, sem float monetario | Cumprido (tipos marcados; `cast` restrito a `as Cents`/`as MicroFraction`) |
| AC4 fuzz money 10.000/10.000; dust 1.000/1.000 | Ambos exit 0 |
| AC5 injecao de falha sem orfao | T18/T19 com estado restaurado + journal |
| AC6 idempotencia 1 execucao | T15/T16 |
| AC7 canonicalizacao | T20-T24 |
| AC8 conciliacao R1-R7 | T25/T26 |
| AC9 I1-I8 positivo e negativo | T28 |
| AC10 docs + GENESIS_HASH publicado | Feito (READMEs e `src/canonical.ts`) |
| AC11 apenas adicoes, compatibilidade retroativa | `audit-trail.ts`, `split-engine.ts`, `escrow-treasury.ts` e T1-T12 intactos |
| AC12 este relatorio | Feito |

## 6. Itens abertos

- **Item 13 - integracao real**: conectividade com Selic/STN, HSM real e publicacao de ancora em DOU/carimbo RFC 3161 permanecem fora do escopo. As interfaces (`AmortizationDep`, `AnchorBackend`, `IdempotencyStore`, `Journal`) ja preveem backends duraveis.
- O manual "Manual de Funcionamento e Protocolo de Analise v1.0 (Partes I-IV)" referenciado pelo prompt nao existe no repositorio; a implementacao seguiu as definicoes de invariantes, interfaces e regras R1-R8 do proprio especifico de engenharia.
