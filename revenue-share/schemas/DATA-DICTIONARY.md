# Dicionário de Dados - Módulo Revenue Share

**Versão:** 1.0.0  
**Data:** 2024-11-02  
**Responsável:** Arquitetura LOWDATAESC  

---

## 1. Introdução

### 1.1 Propósito
Este documento define de forma canônica todas as entidades, atributos e relacionamentos do módulo Revenue Share.

### 1.2 Convenções
- **Nomenclatura:** snake_case para atributos
- **Tipos de dados:** Baseados em JSON Schema
- **Cardinalidade:** 1:1, 1:N, N:M
- **Obrigatoriedade:** Required (R) ou Optional (O)

---

## 2. Entidades Principais

### 2.1 revenue_event
**Descrição:** Registro de um evento que gera receita.

| Atributo | Tipo | Formato | Cardinalidade | Descrição | Exemplo |
|----------|------|---------|---------------|-----------|---------|
| event_id | string | uuid | R | Identificador único | `evt_550e8400...` |
| operation_id | string | uuid | R | Operação que gerou o evento | `op_550e8400...` |
| amount | number | decimal(19,8) | R | Valor bruto | `1000.00` |
| currency | string | iso-4217 | R | Moeda | `BRL`, `USD` |
| timestamp | string | date-time | R | Data/hora do evento | `2024-11-02T10:00:00Z` |
| type | string | enum | R | Tipo do evento | `sale`, `fee`, `interest` |
| jurisdiction | string | iso-3166-1 | R | Jurisdição | `BR`, `US` |
| source | string | enum | R | Fonte | `api`, `kafka`, `batch` |
| status | string | enum | R | Status | `received`, `validated`, `processed` |
| hash | string | sha-256 | R | Hash para integridade | `a1b2c3...` |
| signature | string | - | R | Assinatura digital | `MEUCIQD...` |

**Enum type:** sale, fee, interest, refund, chargeback, adjustment, other
**Enum source:** api, kafka, batch, manual
**Enum status:** received, validated, processed, rejected, cancelled

### 2.2 calculation
**Descrição:** Cálculo de distribuição de receita.

| Atributo | Tipo | Formato | Cardinalidade | Descrição | Exemplo |
|----------|------|---------|---------------|-----------|---------|
| calculation_id | string | uuid | R | Identificador único | `calc_550e8400...` |
| matrix_version | string | - | R | Versão da matriz | `matrix_v1.2.3` |
| period_start | string | date-time | R | Início do período | `2024-11-01T00:00:00Z` |
| period_end | string | date-time | R | Fim do período | `2024-11-01T23:59:59Z` |
| gross_revenue | number | decimal(19,8) | R | Receita bruta | `1000000.00` |
| net_revenue | number | decimal(19,8) | R | Receita líquida | `850000.00` |
| distributable_value | number | decimal(19,8) | R | Valor distribuível | `800000.00` |
| status | string | enum | R | Status | Ver Máquina de Estados |
| calculation_hash | string | sha-256 | R | Hash do cálculo | `a1b2c3...` |

### 2.3 settlement_instruction
**Descrição:** Instrução para liquidação financeira.

| Atributo | Tipo | Formato | Cardinalidade | Descrição | Exemplo |
|----------|------|---------|---------------|-----------|---------|
| instruction_id | string | uuid | R | Identificador único | `instr_550e8400...` |
| calculation_id | string | uuid | R | Cálculo associado | `calc_550e8400...` |
| participant_id | string | uuid | R | Participante destino | `part_550e8400...` |
| amount | number | decimal(19,8) | R | Valor a liquidar | `264000.00` |
| currency | string | iso-4217 | R | Moeda | `BRL` |
| status | string | enum | R | Status | created, pending, processing, completed, failed |
| idempotency_key | string | uuid | R | Chave de idempotência | `idemp_550e8400...` |
| settlement_hash | string | sha-256 | R | Hash da instrução | `a1b2c3...` |

### 2.4 participant
**Descrição:** Participante elegível para distribuição.

| Atributo | Tipo | Formato | Cardinalidade | Descrição | Exemplo |
|----------|------|---------|---------------|-----------|---------|
| participant_id | string | uuid | R | Identificador único | `part_550e8400...` |
| name | string | - | R | Nome | `Fundador A` |
| type | string | enum | R | Tipo | founder, investor, operation |
| status | string | enum | R | Status | active, inactive, pending |
| escrow_account_id | string | uuid | O | Conta escrow | `escrow_550e8400...` |

**Enum type:** founder, investor, operation, employee, other
**Enum status:** active, inactive, pending, blocked

### 2.5 distribution_matrix
**Descrição:** Matriz de distribuição de receita.

| Atributo | Tipo | Formato | Cardinalidade | Descrição | Exemplo |
|----------|------|---------|---------------|-----------|---------|
| matrix_id | string | uuid | R | Identificador único | `matrix_550e8400...` |
| version | string | - | R | Versão | `v1.2.3` |
| name | string | - | R | Nome | `Matriz Pré-Seed 2024` |
| status | string | enum | R | Status | draft, active, deprecated |
| effective_from | string | date-time | R | Vigência inicial | `2024-01-01T00:00:00Z` |
| participants | array | - | R | Participantes | Ver matrix_participant |

### 2.6 reconciliation
**Descrição:** Resultado de reconciliação.

| Atributo | Tipo | Formato | Cardinalidade | Descrição | Exemplo |
|----------|------|---------|---------------|-----------|---------|
| reconciliation_id | string | uuid | R | Identificador único | `reconc_550e8400...` |
| period_start | string | date-time | R | Início do período | `2024-11-01T00:00:00Z` |
| period_end | string | date-time | R | Fim do período | `2024-11-01T23:59:59Z` |
| events_total_amount | number | decimal(19,8) | R | Total de eventos | `1000000.00` |
| settlements_total_amount | number | decimal(19,8) | R | Total de liquidações | `999999.00` |
| discrepancy_total | number | decimal(19,8) | R | Total de divergências | `1.00` |
| status | string | enum | R | Status | pending, completed, failed |

### 2.7 dispute
**Descrição:** Contestação formal.

| Atributo | Tipo | Formato | Cardinalidade | Descrição | Exemplo |
|----------|------|---------|---------------|-----------|---------|
| dispute_id | string | uuid | R | Identificador único | `disp_550e8400...` |
| participant_id | string | uuid | R | Quem abriu | `part_550e8400...` |
| reason | string | enum | R | Motivo | calculation_error, wrong_matrix |
| status | string | enum | R | Status | open, investigation, resolved |
| priority | string | enum | R | Prioridade | low, medium, high, critical |

**Enum reason:** calculation_error, wrong_matrix, unrecognized_event, missing_settlement, wrong_amount, other
**Enum status:** open, investigation, resolved, rejected, cancelled

---

## 3. Relacionamentos

```
revenue_event N --> 1 calculation (included_in)
calculation 1 --> N settlement_instruction (generates)
calculation N --> 1 distribution_matrix (uses)
settlement_instruction N --> 1 participant (pays_to)
dispute N --> 1 calculation (contests)
dispute N --> 1 settlement_instruction (contests)
participant N --> M distribution_matrix (included_in)
```

---

## 4. Schemas JSON Schema

### 4.1 revenue_event_v1
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["event_id", "operation_id", "amount", "currency", "timestamp", "type", "jurisdiction", "source", "hash", "signature"],
  "properties": {
    "event_id": {"type": "string", "format": "uuid"},
    "operation_id": {"type": "string", "format": "uuid"},
    "amount": {"type": "number", "multipleOf": 0.01},
    "currency": {"type": "string", "pattern": "^[A-Z]{3}$"},
    "timestamp": {"type": "string", "format": "date-time"},
    "type": {"type": "string", "enum": ["sale", "fee", "interest", "refund", "chargeback", "adjustment", "other"]},
    "jurisdiction": {"type": "string", "pattern": "^[A-Z]{2}$"},
    "source": {"type": "string", "enum": ["api", "kafka", "batch", "manual"]},
    "hash": {"type": "string", "pattern": "^[a-f0-9]{64}$"},
    "signature": {"type": "string"}
  }
}
```

---

## 5. Políticas de Retenção

| Dados | Retenção | Justificativa |
|-------|----------|---------------|
| Eventos de receita | 7 anos | Conformidade regulatória |
| Cálculos | 7 anos | Auditoria |
| Instruções de liquidação | 7 anos | Auditoria |
| Reconciliações | 7 anos | Auditoria |
| Disputas | 7 anos | Conformidade |
| Trilha de auditoria | 7 anos | Conformidade |

---

**Versão:** 1.0.0  
**Data:** 2024-11-02  
**Responsável:** Arquitetura LOWDATAESC
