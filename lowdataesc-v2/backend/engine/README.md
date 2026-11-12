# **Motor de Regras de Split CBS/IBS, CBA e Yield**
**Versão:** 2.0 | **Classificação:** Restrito / Core do Backend
**Responsável:** Equipe de Arquitetura LOWDATAESC
**Data de Atualização:** 2024-11-15

---

## **📌 Visão Geral**

O **Motor de Regras de Split** é o **coração do backend** da LOWDATAESC v2, responsável por:

1. **Divisão de Receitas (Split CBS/IBS):** Calcular e validar a distribuição de receitas entre **Contribuição sobre Bens e Serviços (CBS)** e **Imposto sobre Bens e Serviços (IBS)** conforme a Reforma Tributária.
2. **Gestão de Créditos de Bens de Ativo (CBA):** Rastrear, validar e conciliar créditos tributários originados de ativos imobilizados.
3. **Cálculo de Yield:** Gerar rendimentos sobre ativos ociosos (Dívida Ativa, Imóveis, Créditos Tributários) com **juros compostos** e distribuição automática.
4. **Retroalimentação:** Aplicar o yield gerado de volta ao pool de custódia, criando um **ciclo de valor contínuo**.

---

## **🏗️ Arquitetura do Motor**

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                        MOTOR DE SPLIT/CBA/YIELD                                │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐          │
│  │  Split CBS/IBS  │    │    CBA Engine   │    │   Yield Engine   │          │
│  │                 │    │                 │    │                 │          │
│  │ • Invariantes   │    │ • Tokenização  │    │ • Juros Compostos│          │
│  │   Fiscais       │    │ • Conciliação   │    │ • Distribuição   │          │
│  │ • Validação     │    │   Federativa    │    │ • Retroalimentação│        │
│  │   PQC           │    │ • Prevenção     │    │                 │          │
│  │                 │    │   Double Spending│    │                 │          │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘          │
│           │                     │                     │                    │
│           ▼                     ▼                     ▼                    │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │                        SUBLEDGER IMUTÁVEL (WORM)                      │     │
│  │  • Hash Encadeado (SHA-256 + PQC)                                     │     │
│  │  • Assinatura Digital (Dilithium)                                      │     │
│  │  • Armazenamento: Fitas Magnéticas (Air-Gapped)                       │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## **📊 Funcionalidades Principais**

### **1. Split CBS/IBS (Divisão de Receitas)**

#### **Regras de Negócio:**
- **Invariante Fiscal:** `Valor_CBS + Valor_IBS + Valor_Retido == Valor_Total_Transacao` (Tolerância: 0.00)
- **Alíquotas Padrão (Reforma Tributária 2024):**
  | **Tipo de Operação**       | **Alíquota CBS** | **Alíquota IBS** | **Total** |
  |----------------------------|------------------|------------------|-----------|
  | Venda de Bens              | 4%               | 8%               | 12%       |
  | Prestação de Serviços      | 5%               | 7%               | 12%       |
  | Importação                 | 6%               | 6%               | 12%       |
  | Operações Financeiras      | 3%               | 9%               | 12%       |

#### **Validações:**
1. **Invariant_Check:** Verifica se a soma de CBS + IBS + Retidos = Total.
2. **Temporal_Check:** Valida se a transação está dentro da janela fiscal vigente.
3. **Signature_Check:** Confirma que a assinatura digital (PQC - Dilithium) é válida.
4. **Compliance_Check:** Garante que a transação não viola LRF, LDO ou LAI.

#### **Ações:**
- **✅ APROVADO:** Transação executada, hash gerado e indexado no Subledger Imutável.
- **❌ REJEITADO:** Transação bloqueada no escrow, evento `ANOMALIA_SPLIT` gerado.

---

### **2. CBA Engine (Crédito de Bens de Ativo)**

#### **Funcionalidades:**
- **Tokenização de Ativos:** Cada CBA recebe um `CBA_ID` único e imutável.
- **Ciclo de Vida do CBA:**
  1. **Aquisição:** Registro da NF-e de origem.
  2. **Depreciação:** Cálculo anual de depreciação linear.
  3. **Uso como Crédito:** Compensação de IBS/CBS.
  4. **Baixa:** Venda, descarte ou encerramento.
- **Prevenção de Double Spending:** Impede que o mesmo CBA seja usado em múltiplos subledgers.

#### **Validações:**
1. **Asset_Lifecycle_Check:** Verifica se o bem possui NF-e válida e não foi baixado/vendido.
2. **Federative_Reconciliation:** Confirma que o valor do crédito corresponde ao IBS/CBS da NF-e ajustado pela depreciação.
3. **No_Double_Spending:** Garante que o `CBA_ID` não foi usado anteriormente.

#### **Ações:**
- **✅ APROVADO:** Crédito tokenizado e disponibilizado para compensação.
- **❌ REJEITADO:** Crédito marcado como `SUSPENDED`, alerta para auditoria cruzada.

---

### **3. Yield Engine (Geração de Rendimentos)**

#### **Funcionalidades:**
- **Cálculo de Yield:** Juros compostos sobre ativos ociosos.
  - **Fórmula:** `Yield = Principal * (1 + DailyRate) ^ Days`
  - **Base:** 100% do CDI (13.65% a.a.) ou taxa contratual.
- **Distribuição Automática:**
  - **60% para o Estado/União** (Tesouro).
  - **40% para o Fundo de Garantia de Ativos Ociosos (FGAO)**.
- **Retroalimentação:** O yield gerado é **reaplicado** no pool de custódia, criando um **efeito composto**.

#### **Validações:**
1. **Yield_Calculation:** Verifica se o cálculo de juros compostos está correto.
2. **Rate_Compliance:** Confirma que a taxa de yield respeita os limites legais.
3. **Hierarchy_Compliance:** Garante que a distribuição segue a hierarquia contratual.

#### **Ações:**
- **✅ APROVADO:** Yield calculado, distribuído e retroalimentado.
- **❌ REJEITADO:** Yield bloqueado, auditoria acionada.

---

## **🔧 Integrações com Outros Módulos**

| **Módulo**               | **Tipo de Integração**       | **Protocolo**               | **Dado Troca**                          |
|--------------------------|-----------------------------|-----------------------------|-----------------------------------------|
| **Compliance**           | API REST (mTLS)              | HTTPS + PQC                 | Validações de compliance (LRF, LDO, LAI) |
| **Crypto**               | RPC (gRPC + PQC)             | TLS 1.3 + Kyber             | Assinaturas digitais (Dilithium)        |
| **TCU**                  | Webhook                      | HTTPS + Assinatura PQC      | Eventos de anomalia fiscal              |
| **PGE-SP**               | Stream (Kafka)               | TLS 1.3 + PQC               | Dados de ativos ociosos                 |
| **CGU**                  | API REST                     | HTTPS + mTLS                | Logs de auditoria                       |
| **ANPD**                 | Batch (SFTP)                 | SSH + Chave PQC             | Dados anonimizados                      |
| **COMITÊ GESTOR IBS**    | API REST                     | HTTPS + mTLS                | Dados de CBA e conciliação federativa    |

---

## **📈 Métricas de Desempenho (SLA)**

| **Métrica**                          | **Meta**               | **Medição**               | **Responsável**       |
|--------------------------------------|------------------------|---------------------------|-----------------------|
| Latência de Split                    | < 50ms                 | Prometheus + Grafana      | Equipe de Infra      |
| Latência de Yield                    | < 100ms                | Prometheus + Grafana      | Equipe de Infra      |
| Precisão do Cálculo de Yield         | ±0.01%                 | Auditoria Interna         | Equipe de Negócios   |
| Taxa de Falsos Positivos (Anomalias) | < 0.1%                 | SIEM (Splunk)             | Equipe de Segurança  |
| Disponibilidade do Motor             | 99.95%                 | UptimeRobot               | Equipe de Infra      |

---

## **🛡️ Segurança e Compliance**

### **1. Criptografia**
- **Assinaturas Digitais:** CRYSTALS-Dilithium (PQC - NIST Standard) para todos os registros.
- **Hashing:** SHA-256 para dados, encadeado cronologicamente.
- **Criptografia de Dados:** AES-256-GCM para dados em repouso, TLS 1.3 + PQC (Kyber) para dados em trânsito.

### **2. Imutabilidade**
- **Subledger Imutável (WORM):** Todos os registros são **gravados uma vez e nunca alterados**.
- **Backup Air-Gapped:** Fitas magnéticas armazenadas em cofre físico, desconectadas da rede.

### **3. Auditoria**
- **Logs Imutáveis:** Todos os acessos e operações são registrados em **WORM Storage**.
- **Retenção:** 10 anos (padrão governamental).
- **Exportação:** Relatórios em PDF (assinado), JSON (API), XML (Padrão TCU/ANPD).

---

## **📁 Estrutura de Arquivos**

```
/backend/engine/
├── split/
│   ├── validator.js          # Validação de invariantes fiscais (CBS/IBS)
│   ├── calculator.js         # Cálculo de split conforme alíquotas
│   └── compliance.js         # Validação de compliance (LRF, LDO, LAI)
│
├── cba/
│   ├── tokenization.js       # Tokenização de ativos (CBA)
│   ├── depreciation.js       # Cálculo de depreciação linear
│   ├── reconciliation.js     # Conciliação federativa (União, Estados, Municípios)
│   └── doublespending.js     # Prevenção de double spending
│
├── yield/
│   ├── calculator.js         # Cálculo de juros compostos
│   ├── distributor.js        # Distribuição de yield (Estado, FGAO)
│   └── retroalimentation.js  # Retroalimentação do pool de custódia
│
├── models/
│   ├── Transaction.js        # Modelo de transação
│   ├── CBA.js                # Modelo de Crédito de Bens de Ativo
│   └── YieldLog.js           # Modelo de log de yield
│
├── services/
│   ├── SubledgerService.js   # Serviço de subledger imutável
│   ├── PQCService.js         # Serviço de criptografia Pós-Quântica
│   └── AuditService.js       # Serviço de auditoria
│
└── README.md                # Este arquivo
```

---

## **🚀 Como Usar (Exemplo de Código)**

### **1. Validação de Split CBS/IBS**
```javascript
const { SplitValidator } = require('./split/validator');

const transaction = {
  Valor_CBS: 4000000,
  Valor_IBS: 8000000,
  Valor_Retido: 0,
  Valor_Total_Transacao: 12000000,
  Timestamp: new Date().toISOString(),
  Originator: "Receita Federal",
  Signature: "Dilithium_Signature_Here"
};

const result = SplitValidator.validate(transaction);

if (result.status === "APROVADO") {
  console.log("✅ Transação aprovada! Hash:", result.hash);
  // Gravar no Subledger Imutável
  SubledgerService.record(result);
} else {
  console.log("❌ Transação rejeitada! Motivo:", result.error);
  // Bloquear no escrow
  EscrowService.block(transaction);
  // Notificar TCU
  TCUService.notifyAnomaly(result);
}
```

### **2. Cálculo de Yield**
```javascript
const { YieldCalculator } = require('./yield/calculator');

const asset = {
  Principal: 100000000,
  DailyRate: 0.0005, // 13.65% a.a. / 252 dias úteis
  Days: 30
};

const yieldResult = YieldCalculator.calculate(asset);
console.log("Yield acumulado:", yieldResult.AccumulatedYield);
console.log("Distribuição:", yieldResult.Distribution); // { Estado: 60%, FGAO: 40% }
```

### **3. Tokenização de CBA**
```javascript
const { CBATokenization } = require('./cba/tokenization');

const cba = {
  NF_e: "NF-e_123456789",
  Valor: 1000000,
  Owner: "CNPJ_12345678000100",
  UsefulLife: 5 // 5 anos
};

const tokenizedCBA = CBATokenization.tokenize(cba);
console.log("CBA_ID:", tokenizedCBA.CBA_ID);
console.log("Hash:", tokenizedCBA.Hash);
```

---

## **📞 Contatos e Suporte**

| **Tipo**               | **Contato**                          | **Email**                          | **Telefone**       |
|------------------------|--------------------------------------|------------------------------------|--------------------|
| **Suporte Técnico**    | Equipe LOWDATAESC                    | suporte@lowdataesc.gov.br          | +55 (61) 9999-9999 |
| **Arquitetura**        | Equipe de Arquitetura LOWDATAESC     | arquitetura@lowdataesc.gov.br      | +55 (61) 9999-8888 |
| **Emergências**        | SOC (Security Operations Center)     | soc@lowdataesc.gov.br              | +55 (61) 9999-0000 |

---

## **📝 Changelog**

| **Versão** | **Data**       | **Descrição**                                                                 | **Responsável**       |
|------------|----------------|-------------------------------------------------------------------------------|-----------------------|
| 2.0        | 2024-11-15     | **Lançamento da v2:** Integração PQC, Subledger Imutável, Retroalimentação    | Equipe LOWDATAESC     |
| 1.5        | 2024-08-20     | Adição de validação de compliance (LRF, LDO, LAI)                             | Equipe LOWDATAESC     |
| 1.0        | 2024-01-10     | Versão inicial com split CBS/IBS básico                                       | Equipe LOWDATAESC     |

---

**⚠️ Aviso Legal:**
Este documento é **confidencial** e destina-se **exclusivamente** ao uso interno da **LOWDATAESC** e parceiros autorizados. A divulgação não autorizada pode resultar em **sanções administrativas e penais**.

---

**🏛️ LOWDATAESC v2.0 | Motor de Split CBS/IBS, CBA e Yield**
*Desenvolvido em colaboração com o Serpro, Dataprev e NIST PQC Standards.*
