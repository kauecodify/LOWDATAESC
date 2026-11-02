# CAP TABLE - [NOME DA EMPRESA]
## Versão: 1.0.0 | Data: 02 de novembro de 2024 | Classificação: Confidencial - Apenas para Uso Interno

---

## **1. RESUMO EXECUTIVO**

| **Métrica** | **Valor** | **Detalhes** |
|-------------|-----------|--------------|
| **Capital Social Total** | R$ [VALOR_TOTAL],00 | [VALOR POR EXTENSO] |
| **Número Total de Cotas** | [N_TOTAL] | Cotas de R$ [VALOR_COTA],00 cada |
| **Número de Sócios** | [N_SOCIOS] | [DETALHE] |
| **Número de Investidores** | [N_INVESTIDORES] | [DETALHE] |
| **Diluição dos Fundadores** | [DILUICAO]% | Após Pré-Seed |
| **Valuation Pós-Money** | R$ [VALUATION],00 | [DETALHE] |

---

## **2. ESTRUTURA DE CAPITAL**

### **2.1. Distribuição de Cotas por Tipo**

| **Tipo** | **N° de Cotas** | **% do Capital** | **Valor (R$)** | **Detentores** |
|----------|-----------------|------------------|----------------|----------------|
| **Fundadores** | [N_FUNDADORES] | [PCT_FUNDADORES]% | [VALOR_FUNDADORES] | [NOMES] |
| **Pré-Seed** | [N_PRE_SEED] | [PCT_PRE_SEED]% | [VALOR_PRE_SEED] | [NOMES] |
| **Reserva de Stock Options** | [N_OPTIONS] | [PCT_OPTIONS]% | [VALOR_OPTIONS] | - |
| **Total** | **[N_TOTAL]** | **100%** | **[VALOR_TOTAL]** | - |

---

### **2.2. Detalhamento por Sócio/Investidor**

#### **Fundadores Oficiais**

| **Nome** | **CPF/CNPJ** | **N° de Cotas** | **% do Capital** | **Valor (R$)** | **Vesting** | **Status** | **Data de Entrada** |
|----------|--------------|-----------------|------------------|----------------|-------------|------------|---------------------|
| [NOME FUNDADOR 1] | [CPF] | [N_COTAS] | [PCT]% | [VALOR] | 4 anos (cliff 1 ano) | Ativo | [DATA] |
| [NOME FUNDADOR 2] | [CPF] | [N_COTAS] | [PCT]% | [VALOR] | 4 anos (cliff 1 ano) | Ativo | [DATA] |
| [NOME FUNDADOR 3] | [CPF] | [N_COTAS] | [PCT]% | [VALOR] | 4 anos (cliff 1 ano) | Ativo | [DATA] |
| **Total Fundadores** | - | **[N_FUNDADORES]** | **[PCT_FUNDADORES]%** | **[VALOR_FUNDADORES]** | - | - | - |

**Observações:**
- Os Fundadores estão sujeitos a **vesting de 4 anos com cliff de 1 ano** (conforme [VESTING-AGREEMENT.md](./VESTING-AGREEMENT.md)).
- **33% dos Rendimentos Distribuíveis** são garantidos aos Fundadores, independentemente de sua participação no capital (conforme [SOCIAL-CONTRACT.md](./SOCIAL-CONTRACT.md)).

---

#### **Investidores Pré-Seed**

| **Nome/Razão Social** | **CPF/CNPJ** | **N° de Cotas** | **% do Capital** | **Valor (R$)** | **Tipo de Investimento** | **Data de Entrada** | **Documentação** |
|------------------------|--------------|-----------------|------------------|----------------|---------------------------|---------------------|-----------------|
| [NOME INVESTIDOR 1] | [CNPJ] | [N_COTAS] | [PCT]% | [VALOR] | Equity | [DATA] | [DOC] |
| [NOME INVESTIDOR 2] | [CNPJ] | [N_COTAS] | [PCT]% | [VALOR] | Equity | [DATA] | [DOC] |
| [NOME INVESTIDOR 3] | [CNPJ] | [N_COTAS] | [PCT]% | [VALOR] | Convertível | [DATA] | [DOC] |
| **Total Pré-Seed** | - | **[N_PRE_SEED]** | **[PCT_PRE_SEED]%** | **[VALOR_PRE_SEED]** | - | - | - |

**Observações:**
- Os investidores Pré-Seed têm direito a **67% dos Rendimentos Distribuíveis** (conforme [SOCIAL-CONTRACT.md](./SOCIAL-CONTRACT.md)).
- Investimentos **convertíveis** serão convertidos em cotas na próxima rodada de investimento.

---

#### **Reserva de Stock Options**

| **Destinação** | **N° de Cotas** | **% do Capital** | **Valor (R$)** | **Vesting** | **Status** |
|----------------|-----------------|------------------|----------------|-------------|------------|
| Funcionários | [N_OPTIONS_FUNC] | [PCT_OPTIONS_FUNC]% | [VALOR] | 4 anos (cliff 1 ano) | Disponível |
| Consultores | [N_OPTIONS_CONS] | [PCT_OPTIONS_CONS]% | [VALOR] | 4 anos (cliff 1 ano) | Disponível |
| **Total Reservado** | **[N_OPTIONS]** | **[PCT_OPTIONS]%** | **[VALOR_OPTIONS]** | - | - |

**Observações:**
- A **Reserva de Stock Options** representa **[PCT_OPTIONS]%** do capital social total.
- As opções serão **emitidas conforme necessidade**, com aprovação do **Conselho de Sócios**.

---

## **3. HISTÓRICO DE CAPITALIZAÇÃO**

### **3.1. Rodadas de Investimento**

| **Rodada** | **Data** | **Valor Captado (R$)** | **Valuation Pré-Money (R$)** | **Valuation Pós-Money (R$)** | **N° de Cotas Emitidas** | **Diluição dos Fundadores** | **Documentação** |
|------------|----------|------------------------|--------------------------------|-------------------------------|---------------------------|-----------------------------|-----------------|
| **Fundação** | [DATA] | R$ [VALOR],00 | R$ 0,00 | R$ [VALOR],00 | [N_COTAS] | 0% | [DOC] |
| **Pré-Seed** | [DATA] | R$ [VALOR],00 | R$ [VALOR],00 | R$ [VALOR],00 | [N_COTAS] | [DILUICAO]% | [DOC] |
| **Seed** | - | - | - | - | - | - | - |
| **Series A** | - | - | - | - | - | - | - |

---

### **3.2. Evolução da Participação dos Fundadores**

| **Evento** | **Data** | **% Fundadores Antes** | **% Fundadores Depois** | **Diluição** |
|------------|----------|------------------------|-------------------------|-------------|
| Fundação | [DATA] | 100% | 100% | 0% |
| Pré-Seed | [DATA] | 100% | [PCT_DEPOIS]% | [DILUICAO]% |
| Seed | - | [PCT_DEPOIS]% | - | - |
| Series A | - | - | - | - |

---

## **4. DISTRIBUIÇÃO DE RENDIMENTOS**

### **4.1. Matriz de Revenue Share**

| **Participante** | **% dos Rendimentos Distribuíveis** | **Base Legal** | **Vigência** |
|------------------|--------------------------------------|----------------|--------------|
| Fundadores Oficiais | 33% | [SOCIAL-CONTRACT.md](./SOCIAL-CONTRACT.md) | [DATA] - Atual |
| Pré-Seed Investors | 67% | Acordo de Investimento Pré-Seed | [DATA] - Atual |
| **Total** | **100%** | - | - |

**Fórmula de Cálculo:**
```
Rendimentos Distribuíveis = Receita Líquida - Reservas
```

**Onde:**
- **Receita Líquida** = Receita Bruta - Deduções (impostos, chargebacks, taxas operacionais);
- **Reservas** = Reservas Legais + Reservas Estatutárias + Reservas de Contingência + Reservas de Liquidez.

**Detalhes:**
- A **matriz de distribuição** está detalhada em [DISTRIBUTION-MATRIX.md](../models/DISTRIBUTION-MATRIX.md).
- Os **33% dos Fundadores** são distribuídos **igualmente** entre os 3 Fundadores Oficiais.
- Os **67% dos Investidores** são distribuídos **proporcionalmente** à sua participação no capital Pré-Seed.

---

### **4.2. Distribuição de Lucros**

| **Participante** | **% dos Lucros** | **Base Legal** | **Frequência** |
|------------------|-------------------|----------------|----------------|
| Fundadores Oficiais | [PCT_LUCROS_FUND]% | [SOCIAL-CONTRACT.md](./SOCIAL-CONTRACT.md) | Trimestral |
| Pré-Seed Investors | [PCT_LUCROS_INVEST]% | Acordo de Investimento Pré-Seed | Trimestral |
| **Total** | **100%** | - | - |

**Observações:**
- A **distribuição de lucros** é feita **após a distribuição dos Rendimentos Distribuíveis**.
- Os **lucros** são distribuídos **na proporção das cotas** de cada sócio/investidor.

---

## **5. VALORAÇÃO E MÉTRICAS FINANCEIRAS**

### **5.1. Valuation Atual**

| **Métrica** | **Valor (R$)** | **Data** | **Fonte** |
|-------------|-----------------|----------|-----------|
| **Valuation Pré-Money** | [VALOR] | [DATA] | [FONTE] |
| **Valuation Pós-Money** | [VALOR] | [DATA] | [FONTE] |
| **Capital Social** | [VALOR] | [DATA] | [FONTE] |
| **Reservas** | [VALOR] | [DATA] | [FONTE] |
| **Patrimônio Líquido** | [VALOR] | [DATA] | [FONTE] |

---

### **5.2. Múltiplos**

| **Múltiplo** | **Valor** | **Benchmark** | **Observações** |
|--------------|-----------|---------------|-----------------|
| **Receita (TTM)** | [X]x | [BENCH] | - |
| **EBITDA (TTM)** | [X]x | [BENCH] | - |
| **Lucro Líquido (TTM)** | [X]x | [BENCH] | - |

---

## **6. DIREITOS E PREFERÊNCIAS**

### **6.1. Direitos dos Fundadores**

| **Direito** | **Fundadores** | **Investidores Pré-Seed** | **Observações** |
|-------------|----------------|----------------------------|-----------------|
| **Voto** | ✅ Sim | ✅ Sim | 1 cota = 1 voto |
| **Dividendos** | ✅ Sim | ✅ Sim | Proporcional às cotas |
| **Liquidação** | ✅ Sim | ✅ Sim (preferencial) | Investidores têm preferência |
| **Venda de Cotas** | ❌ Não (lock-up) | ✅ Sim | Sujeito a direito de preferência |
| **Tag Along** | ✅ Sim | ✅ Sim | Direito de vender junto |
| **Drag Along** | ✅ Sim | ✅ Sim | Obrigação de vender junto |
| **Anti-Diluição** | ❌ Não | ✅ Sim | Proteção para investidores |
| **Informações** | ✅ Sim | ✅ Sim | Acesso a relatórios |

---

### **6.2. Preferências dos Investidores**

| **Preferência** | **Detalhes** | **Vigência** |
|-----------------|--------------|--------------|
| **Liquidação Preferencial** | Investidores recebem **1x o investimento** antes dos Fundadores | Até Series A |
| **Anti-Diluição** | Ajuste automático em caso de down round | Todas as rodadas |
| **Direito de Preferência** | Investidores têm **direito de preferência** em novas rodadas | Todas as rodadas |
| **Tag Along** | Investidores podem **vender junto** com os Fundadores | Todas as rodadas |
| **Drag Along** | Investidores podem **obrigar os Fundadores a vender** | Todas as rodadas |
| **Veto** | Investidores têm **direito de veto** em decisões estratégicas | Até Series A |

---

## **7. GOVERNANÇA**

### **7.1. Conselho de Sócios**

| **Membro** | **Cargo** | **N° de Cotas** | **% de Voto** | **Função** |
|------------|-----------|-----------------|---------------|------------|
| [NOME FUNDADOR 1] | CEO | [N_COTAS] | [PCT]% | Gestão Operacional |
| [NOME FUNDADOR 2] | CFO | [N_COTAS] | [PCT]% | Finanças |
| [NOME FUNDADOR 3] | CTO | [N_COTAS] | [PCT]% | Tecnologia |
| [NOME INVESTIDOR 1] | Board Member | [N_COTAS] | [PCT]% | Representante Investidores |

**Observações:**
- O **Conselho de Sócios** é responsável por **decisões estratégicas**.
- As **decisões** são tomadas por **maioria simples** (50% + 1 dos votos), salvo em casos expressamente previstos.

---

### **7.2. Comitês**

| **Comitê** | **Membros** | **Função** |
|------------|-------------|------------|
| **Comitê de Auditoria** | CFO, CCO, [NOME] | Supervisão de auditoria e compliance |
| **Comitê de Remuneração** | CEO, CFO, [NOME] | Definição de políticas de remuneração |
| **Comitê de Tecnologia** | CTO, [NOME] | Supervisão de desenvolvimento tecnológico |

---

## **8. PROCEDIMENTOS OPERACIONAIS**

### **8.1. Emissão de Novas Cotas**

**Procedimento:**
1. **Aprovação do Conselho de Sócios** (maioria absoluta);
2. **Aprovação dos Investidores** (se aplicável);
3. **Atualização do Contrato Social**;
4. **Registro na Junta Comercial**;
5. **Atualização do Cap Table**;
6. **Notificação aos Sócios**.

---

### **8.2. Transferência de Cotas**

**Procedimento:**
1. **Solicitação do Sócio** (por escrito);
2. **Aprovação do Conselho de Sócios** (maioria absoluta);
3. **Direito de Preferência** (oferecer às partes interessadas);
4. **Aprovação do Comprador** (se aplicável);
5. **Assinatura de Contrato de Transferência**;
6. **Averbamento no Livro de Registro de Sócios**;
7. **Atualização do Cap Table**.

---

### **8.3. Saída de Sócios**

**Procedimento (Good Leaver):**
1. **Notificação do Sócio** (60 dias de antecedência);
2. **Classificação como Good Leaver**;
3. **Cálculo das Cotas Vestidas**;
4. **Acceleration Automática** (100% das cotas não vestidas vestem);
5. **Venda das Cotas** (à SOCIEDADE ou a terceiros);
6. **Formalização da Saída**;
7. **Atualização do Cap Table**.

**Procedimento (Bad Leaver):**
1. **Notificação da SOCIEDADE** (justa causa);
2. **Classificação como Bad Leaver**;
3. **Cálculo das Cotas Vestidas**;
4. **Forfeiture** (perda de cotas não vestidas);
5. **Compra das Cotas Vestidas** (pelo valor nominal);
6. **Formalização da Saída**;
7. **Atualização do Cap Table**.

---

### **8.4. Atualização do Cap Table**

**Frequência:** Mensal
**Responsável:** CFO

**Itens a Atualizar:**
- [ ] Novas emissões de cotas;
- [ ] Transferências de cotas;
- [ ] Saída de sócios;
- [ ] Vesting de cotas;
- [ ] Conversão de dívidas em cotas;
- [ ] Ajustes por anti-diluição;
- [ ] Atualização de valuation.

---

## **9. RELATÓRIOS**

### **9.1. Relatório Mensal de Cap Table**

**Conteúdo:**
- **Resumo Executivo** (capital social, número de cotas, valuation);
- **Distribuição de Cotas** (por sócio/investidor);
- **Vesting Status** (cotas vestidas vs. não vestidas);
- **Movimentações do Mês** (emissões, transferências, saídas);
- **Próximas Rodadas** (previsão de captação);
- **Riscos e Oportunidades** (diluição, valuation).

**Destinatários:**
- Conselho de Sócios;
- Investidores (resumo);
- Auditoria.

---

### **9.2. Relatório Trimestral de Governança**

**Conteúdo:**
- **Atualização do Cap Table**;
- **Distribuição de Rendimentos**;
- **Distribuição de Lucros**;
- **Decisões do Conselho**;
- **Auditoria e Compliance**;
- **Previsões para o Próximo Trimestre**.

**Destinatários:**
- Conselho de Sócios;
- Investidores;
- Auditoria.

---

### **9.3. Relatório Anual de Auditoria**

**Conteúdo:**
- **Cap Table Auditado**;
- **Movimentações Anuais**;
- **Conformidade com Contrato Social**;
- **Conformidade com Reguladores** (BCB, CVM, SUSEP);
- **Recomendações de Melhoria**.

**Destinatários:**
- Conselho de Sócios;
- Investidores;
- Órgãos Reguladores (se aplicável).

---

## **10. CONFORMIDADE REGULATÓRIA**

### **10.1. Requisitos por Regulador**

| **Regulador** | **Requisito** | **Como Atendemos** | **Documentação** |
|---------------|---------------|--------------------|------------------|
| **Junta Comercial** | Registro de Sócios | Livro de Registro de Sócios | [DOC] |
| **Receita Federal** | Declaração de Rendimentos | DIRF, DIPJ | [DOC] |
| **BCB** | Controle Societário | Cap Table Atualizado | [DOC] |
| **CVM** | Transparência | Relatórios Trimestrais | [DOC] |
| **SUSEP** | Governança | Políticas Internas | [DOC] |
| **ANPD** | Proteção de Dados | LGPD Compliance | [DOC] |

---

### **10.2. Auditoria Externa**

| **Auditor** | **Escopo** | **Frequência** | **Próxima Auditoria** |
|-------------|------------|----------------|-----------------------|
| [NOME AUDITOR] | Cap Table e Governança | Anual | [DATA] |
| [NOME AUDITOR] | Compliance Regulatório | Semestral | [DATA] |

---

## **11. CONTROLE DE VERSÃO**

| **Versão** | **Data** | **Autor** | **Mudanças** | **Aprovação** |
|------------|----------|-----------|--------------|---------------|
| 1.0.0 | 02/11/2024 | Vibe Code | Criação inicial | Pendente |

---

## **12. APROVAÇÕES**

| **Role** | **Nome** | **Assinatura** | **Data** |
|----------|----------|----------------|----------|
| Chief Financial Officer | [CFO Name] | _______________ | _______ |
| Chief Executive Officer | [CEO Name] | _______________ | _______ |
| Chief Compliance Officer | [CCO Name] | _______________ | _______ |

---

*Este documento é **Confidencial** e destina-se apenas a uso interno da SOCIEDADE.*
*Qualquer reprodução, distribuição ou uso não autorizado está expressamente proibido.*
*Em caso de dúvidas, consultar o **Chief Financial Officer (CFO)**.*
