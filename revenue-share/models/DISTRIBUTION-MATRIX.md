# Documento da Matriz de Distribuição de Revenue Share

**Versão:** 1.0.0  
**Data:** 2024-11-02  
**Responsável:** Arquitetura LOWDATAESC  
**Status:** Aprovado  

---

## 1. Introdução

### 1.1 Propósito
Este documento define a matriz de distribuição de receita para o módulo Revenue Share, incluindo percentuais, participantes, pisos, tetos, condições de elegibilidade e regras de exceção.

### 1.2 Escopo
A matriz define como o **Valor Líquido Distribuível** (após deduções e reservas) é distribuído entre os participantes elegíveis do ecossistema LOWDATAESC.

### 1.3 Vigência
- **Versão:** `matrix_v1.0.0`
- **Vigência:** 2024-11-02 a 2025-10-31
- **Status:** Ativa

---

## 2. Participantes e Percentuais

### 2.1 Distribuição Base

| Participante | Tipo | Percentual | Piso (BRL) | Teto (BRL) | Prioridade | Elegível |
|--------------|------|------------|------------|------------|------------|----------|
| Fundadores Oficiais | founder | 33.00% | 10,000.00 | - | 1 | Sim |
| Investidores Pré-Seed | investor | 67.00% | 20,000.00 | - | 2 | Sim |

**Total:** 100.00%

### 2.2 Detalhes dos Participantes

#### Fundadores Oficiais (33%)
- **Composição:** 3 fundadores
- **Distribuição interna:**
  - Fundador A: 11.00%
  - Fundador B: 11.00%
  - Fundador C: 11.00%
- **Piso individual:** R$ 3,333.33 (33% de R$ 10,000.00)
- **Vesting:** Aplicável conforme [Instrumento de Vesting](../legal/VESTING-AGREEMENT.md)
- **Conta escrow:** `escrow_founders_official`

#### Investidores Pré-Seed (67%)
- **Composição:** 10 investidores
- **Distribuição interna:** Ver [Cap Table](../legal/CAP-TABLE.md)
- **Piso individual:** R$ 2,000.00 (mínimo por investidor)
- **Vesting:** Conforme acordo de investimento
- **Conta escrow:** `escrow_investors_pre_seed`

---

## 3. Regras de Elegibilidade

### 3.1 DSL de Elegibilidade

A linguagem de condições (DSL) para elegibilidade é baseada em expressões booleanas com os seguintes operadores e funções:

#### Operadores Lógicos
- `AND`: E lógico
- `OR`: Ou lógico
- `NOT`: Negação
- `==`: Igual
- `!=`: Diferente
- `>`: Maior que
- `<`: Menor que
- `>=`: Maior ou igual
- `<=`: Menor ou igual

#### Funções Disponíveis
- `status(participant_id)`: Status do participante (`active`, `inactive`, `pending`, `blocked`)
- `compliance(participant_id)`: Status de compliance (`ok`, `pending`, `failed`)
- `contract(participant_id)`: Status do contrato (`signed`, `pending`, `expired`, `none`)
- `kyc(participant_id)`: Status de KYC (`verified`, `pending`, `failed`, `none`)
- `vesting(participant_id)`: Percentual vestido (0.0 a 1.0)
- `date()`: Data atual
- `periodStart()`: Data de início do período de cálculo
- `periodEnd()`: Data de fim do período de cálculo

#### Exemplo de DSL
```
status(participant_id) == "active" AND 
compliance(participant_id) == "ok" AND 
contract(participant_id) == "signed" AND 
kyc(participant_id) == "verified"
```

### 3.2 Regras Padrão de Elegibilidade

#### Para Fundadores Oficiais
```
status(participant_id) == "active" AND 
compliance(participant_id) == "ok" AND 
contract(participant_id) == "signed" AND 
vesting(participant_id) > 0.0
```

#### Para Investidores Pré-Seed
```
status(participant_id) == "active" AND 
compliance(participant_id) == "ok" AND 
contract(participant_id) == "signed" AND 
kyc(participant_id) == "verified"
```

---

## 4. Regras de Exceção

### 4.1 Estorno (Chargeback)
- **Ação:** Valor do estorno é deduido proporcionalmente de todos os participantes
- **Cálculo:** `estorno_amount * (participant_percentage / 100)`
- **Limite:** Não pode resultar em valor negativo para o participante
- **Tratamento:** Se o participante não tiver saldo suficiente, a diferença é coberta pela reserva de contingência

### 4.2 Devolução (Refund)
- **Ação:** Similar ao estorno, mas com origem em solicitação do cliente
- **Cálculo:** `refund_amount * (participant_percentage / 100)`

### 4.3 Inadimplência
- **Ação:** Participante inadimplente tem distribuição suspensa
- **Condição:** `compliance(participant_id) == "failed"`
- **Redistribuição:** Percentual do participante inadimplente é redistribuído proporcionalmente aos demais participantes elegíveis

### 4.4 Imposto Retido
- **Ação:** Impostos retidos na fonte são deduidos antes da distribuição
- **Cálculo:** Conforme [Fórmula de Rendimento Distribuível](../accounting/FORMULA-RENDIMENTO.md)

### 4.5 Disputa
- **Ação:** Durante uma disputa, a distribuição para o cálculo contestado é suspensa
- **Condição:** `dispute_status(calculation_id) == "open" OR dispute_status(calculation_id) == "investigation"`
- **Redistribuição:** Após resolução, o valor é ajustado conforme a decisão

---

## 5. Pisos e Tetos

### 5.1 Aplicação de Pisos
- **Condição:** Se `calculated_amount < floor` para um participante
- **Ação:** Participante recebe o piso
- **Redistribuição:** A diferença (`floor - calculated_amount`) é subtraída proporcionalmente dos demais participantes
- **Limite:** A redistribuição não pode fazer com que outros participantes fiquem abaixo de seus pisos

### 5.2 Aplicação de Tetos
- **Condição:** Se `calculated_amount > cap` para um participante
- **Ação:** Participante recebe o teto
- **Redistribuição:** O excesso (`calculated_amount - cap`) é distribuído proporcionalmente aos demais participantes

### 5.3 Exemplo de Aplicação

**Cenário:**
- Valor Líquido Distribuível: R$ 100,000.00
- Fundadores: 33% = R$ 33,000.00 (Piso: R$ 50,000.00)
- Investidores: 67% = R$ 67,000.00 (Piso: R$ 20,000.00)

**Cálculo:**
1. Fundadores: R$ 33,000.00 < R$ 50,000.00 → Recebe R$ 50,000.00
2. Diferença: R$ 50,000.00 - R$ 33,000.00 = R$ 17,000.00
3. Investidores: R$ 67,000.00 - R$ 17,000.00 = R$ 50,000.00
4. Verificar piso dos investidores: R$ 50,000.00 > R$ 20,000.00 ✓
5. **Resultado final:** Fundadores: R$ 50,000.00, Investidores: R$ 50,000.00

---

## 6. Métodos de Redistribuição

### 6.1 Redistribuição Proporcional (Padrão)
- **Descrição:** Excesso ou deficiência é distribuído proporcionalmente aos percentuais dos participantes
- **Fórmula:** `excesso * (participant_percentage / total_percentage)`

### 6.2 Redistribuição por Prioridade
- **Descrição:** Excesso é distribuído conforme prioridade dos participantes
- **Ordem:** Participantes com menor prioridade recebem primeiro

### 6.3 Sem Redistribuição
- **Descrição:** Excesso é retido como reserva ou devolvido à operação
- **Uso:** Configurável por matriz

---

## 7. Conversão de Moedas

### 7.1 Taxas de Câmbio
- **Fonte:** Banco Central do Brasil (BACEN) ou European Central Bank (ECB)
- **Atualização:** Diária (00:00 UTC)
- **Precisão:** 8 casas decimais
- **Arredondamento:** Banker's rounding

### 7.2 Processo de Conversão
1. **Identificar moedas:** Verificar moeda de cada evento e participante
2. **Converter para moeda base:** Converter todos os valores para a moeda base da matriz (BRL)
3. **Calcular distribuição:** Aplicar percentuais em moeda base
4. **Converter para moeda do participante:** Converter valor distribuído para a moeda do participante

### 7.3 Moeda Base
- **Padrão:** BRL (Real Brasileiro)
- **Configurável:** Por matriz

---

## 8. Arredondamento

### 8.1 Regras de Arredondamento
- **Precisão interna:** 8 casas decimais
- **Precisão de apresentação:** 2 casas decimais
- **Método:** Banker's rounding (round half to even)

### 8.2 Aplicação
1. **Cálculos internos:** 8 casas decimais
2. **Valores monetários:** 2 casas decimais
3. **Percentuais:** 4 casas decimais

### 8.3 Exemplo
- Valor: R$ 1,234.56789
- Arredondado: R$ 1,234.57 (2 casas)
- Cálculo interno: R$ 1,234.56789000 (8 casas)

---

## 9. Versionamento da Matriz

### 9.1 Processo de Atualização
1. **Solicitação:** Operador ou participante solicita nova versão
2. **Justificativa:** Motivo documentado (novo participante, ajuste de percentuais, etc.)
3. **Revisão Compliance:** Verificar conformidade regulatória
4. **Revisão Jurídica:** Verificar conformidade contratual
5. **Aprovação:** Assinaturas digitais de todas as partes
6. **Data de Vigência:** Definir quando a nova versão entra em vigor
7. **Notificação:** Comunicar todos os participantes
8. **Publicação:** Tornar a versão ativa no sistema
9. **Arquivamento:** Manter versão anterior para auditabilidade

### 9.2 Histórico de Versões

| Versão | Vigência | Descrição | Status |
|--------|----------|-----------|--------|
| matrix_v1.0.0 | 2024-11-02 a 2025-10-31 | Matriz inicial Pré-Seed | Ativa |

---

## 10. Contratos entre Operações

### 10.1 Requisitos Contratuais
A matriz de distribuição deve estar refletida em contrato jurídico entre:
- LOWDATAESC (plataforma)
- Fundadores Oficiais
- Investidores Pré-Seed
- Operações conectadas (se aplicável)

### 10.2 Cláusulas Obligatórias
1. **Percentuais:** Definição clara dos percentuais de distribuição
2. **Pisos e tetos:** Valores mínimos e máximos garantidos
3. **Elegibilidade:** Critérios para participação
4. **Deduções:** Tipos de deduções permitidas
5. **Redistribuição:** Regras para redistribuição de excessos/deficiências
6. **Conversão de moedas:** Método e taxas de câmbio
7. **Arredondamento:** Regras de arredondamento
8. **Versionamento:** Processo para atualização da matriz
9. **Resolução de disputas:** Processo para contestações
10. **Vigência:** Período de validade do contrato

### 10.3 Referência
- **Contrato principal:** `CONTRATO-REVENUE-SHARE-2024-001`
- **Anexos:** Este documento (matrix_v1.0.0) é anexo ao contrato

---

## 11. Conformidade Regulatória

### 11.1 BCB (Banco Central do Brasil)
- **Requisitos:** Segregação de contas, rastro de auditoria, relatórios periódicos
- **Aplicabilidade:** Para operações financeiras no Brasil
- **Conformidade:** ✓ Atende

### 11.2 CVM (Comissão de Valores Mobiliários)
- **Requisitos:** Transparência, tratamento justo entre investidores
- **Aplicabilidade:** Para fundos de investimento
- **Conformidade:** ✓ Atende

### 11.3 LGPD (Lei Geral de Proteção de Dados)
- **Requisitos:** Base legal para processamento de dados, consentimento, retenção
- **Aplicabilidade:** Para todos os participantes
- **Conformidade:** ✓ Atende (ver [Avaliação LGPD](../compliance/LGPD-ASSESSMENT.md))

### 11.4 Tributária
- **Requisitos:** Retenção na fonte, emissão de informativos
- **Aplicabilidade:** Conforme jurisdição
- **Conformidade:** ✓ Atende (ver [Parecer Tributário](../legal/TAX-OPINION.md))

---

## 12. Implementação Técnica

### 12.1 Schema da Matriz

```json
{
  "matrix_id": "matrix_550e8400-e29b-41d4-a716-446655440000",
  "version": "v1.0.0",
  "name": "Matriz Pré-Seed 2024",
  "description": "Distribuição para fundadores e investidores Pré-Seed",
  "status": "active",
  "effective_from": "2024-11-02T00:00:00Z",
  "effective_to": "2025-10-31T23:59:59Z",
  "base_currency": "BRL",
  "total_percentage": 100.00,
  "participants": [
    {
      "participant_id": "part_founders_official",
      "type": "founder",
      "percentage": 33.00,
      "floor": 10000.00,
      "cap": null,
      "priority": 1,
      "eligibility_dsl": "status(participant_id) == \"active\" AND compliance(participant_id) == \"ok\" AND contract(participant_id) == \"signed\" AND vesting(participant_id) > 0.0",
      "eligible": true
    },
    {
      "participant_id": "part_investors_pre_seed",
      "type": "investor",
      "percentage": 67.00,
      "floor": 20000.00,
      "cap": null,
      "priority": 2,
      "eligibility_dsl": "status(participant_id) == \"active\" AND compliance(participant_id) == \"ok\" AND contract(participant_id) == \"signed\" AND kyc(participant_id) == \"verified\"",
      "eligible": true
    }
  ],
  "rules": {
    "rounding_method": "bankers",
    "redistribution_method": "proportional",
    "currency_conversion": "daily_rate",
    "exception_handling": {
      "chargeback": "proportional_deduction",
      "refund": "proportional_deduction",
      "default": "suspend_distribution"
    }
  },
  "contract_reference": "CONTRATO-REVENUE-SHARE-2024-001",
  "approved_by": [
    {
      "user_id": "user_compliance_a",
      "role": "compliance",
      "timestamp": "2024-10-01T10:00:00Z",
      "signature": "MEUCIQD..."
    },
    {
      "user_id": "user_legal_a",
      "role": "legal",
      "timestamp": "2024-10-01T11:00:00Z",
      "signature": "MEUCIQD..."
    }
  ],
  "approved_at": "2024-10-01T12:00:00Z",
  "matrix_hash": "a1b2c3d4e5f6...",
  "created_at": "2024-09-01T00:00:00Z",
  "updated_at": "2024-10-01T12:00:00Z"
}
```

### 12.2 Integração com o Módulo
- **API:** `GET /api/v1/distribution-matrices/{matrix_id}`
- **Validação:** Schema validation + assinatura digital
- **Cache:** Versão ativa cacheada por período

---

## 13. Critérios de Aceite

- [ ] Matriz definida com percentuais, pisos, tetos e condições de elegibilidade
- [ ] DSL de elegibilidade implementada e validada
- [ ] Regras de exceção documentadas e implementadas
- [ ] Contratos jurídicos alinhados com a matriz
- [ ] Conformidade regulatória verificada
- [ ] Schema técnico implementado e versionado
- [ ] Integração com o módulo funcional

---

## 14. Anexos

- [Contrato Social e Acordo de Sócios](../legal/SOCIAL-CONTRACT.md)
- [Instrumento de Vesting](../legal/VESTING-AGREEMENT.md)
- [Cap Table](../legal/CAP-TABLE.md)
- [Parecer Jurídico](../legal/LEGAL-OPINION.md)
- [Parecer Tributário](../legal/TAX-OPINION.md)
- [Avaliação LGPD](../compliance/LGPD-ASSESSMENT.md)

---

**Aprovado por:** _________________________  
**Data:** _______________  
**Versão:** 1.0.0
