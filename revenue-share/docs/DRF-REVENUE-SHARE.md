# Documento de Requisitos Funcionais (DRF) - Módulo Revenue Share

**Versão:** 1.0.0  
**Data:** 2024-11-02  
**Responsável:** Arquitetura LOWDATAESC  
**Status:** Aprovado  

---

## 1. Introdução

### 1.1 Propósito
Este documento define os requisitos funcionais do módulo de Revenue Share da plataforma LOWDATAESC, projetado para distribuir receitas entre participantes de forma segura, auditável e conforme com regulamentações internacionais.

### 1.2 Escopo
O módulo Revenue Share é responsável por:
- Ingestão de eventos de receita
- Cálculo de distribuição baseado em matriz de regras
- Processo de aprovação multi-nível
- Liquidação financeira via integracão com LOWDATAESC
- Reconciliação automática
- Gerenciamento de disputas

### 1.3 Definições
Consulte o [Glossário de Negócio](./GLOSSARY.md) para definições completas.

---

## 2. Requisitos Funcionais

### 2.1 Ingestão de Eventos de Receita

#### RF-001 - Ingestão de Eventos
- **Descrição:** O sistema deve receber eventos de receita de fontes múltiplas
- **Fontes:** 
  - APIs REST (JSON)
  - Kafka topics (Avro)
  - Batch upload (CSV/Parquet)
- **Validação:** Schema validation, assinatura digital, idempotência
- **Prioridade:** Alta

#### RF-002 - Normalização de Dados
- **Descrição:** Converter eventos de diferentes formatos para o schema canônico
- **Schema canônico:** `revenue_event_v1`
- **Validação:** Campos obrigatórios, formatação, consistência
- **Prioridade:** Alta

#### RF-003 - Armazenamento de Eventos
- **Descrição:** Persistir eventos em storage imutável
- **Armazenamento:** S3 com Object Lock + WORM
- **Retenção:** 7 anos (conformidade regulatória)
- **Indexação:** Por data, operação, tipo de evento
- **Prioridade:** Alta

### 2.2 Cálculo de Distribuição

#### RF-004 - Aplicação de Matriz de Distribuição
- **Descrição:** Aplicar percentuais da matriz de revenue share aos eventos
- **Matriz:** Definida em `distribution_matrix_v1`
- **Cálculo:** 
  - Receita bruta → deduções → receita líquida → distribuição
  - Respeitar pisos e tetos por participante
  - Verificar elegibilidade via DSL
- **Prioridade:** Crítica

#### RF-005 - Cálculo de Deduções
- **Descrição:** Calcular deduções conforme política contábil
- **Tipos de deduções:**
  - Taxas operacionais
  - Impostos retidos
  - Reservas (contingência, liquidez)
  - Chargebacks/Estornos
- **Ordem:** Definida na [Fórmula Oficial de Rendimento Distribuível](../accounting/FORMULA-RENDIMENTO.md)
- **Prioridade:** Crítica

#### RF-006 - Arredondamento
- **Descrição:** Aplicar regras de arredondamento financeiro
- **Precisão:** 8 casas decimais para cálculos internos
- **Apresentação:** 2 casas decimais para valores monetários
- **Método:** Banker's rounding (round half to even)
- **Prioridade:** Alta

### 2.3 Workflow de Aprovação

#### RF-007 - Criação de Calculation
- **Descrição:** Gerar entidade `calculation` com status inicial
- **Status inicial:** `DRAFT`
- **Conteúdo:** Eventos, matriz aplicada, resultados de cálculo
- **Hash:** `calculation_hash` para rastreabilidade
- **Prioridade:** Crítica

#### RF-008 - Processo de Aprovação Multi-Nível
- **Descrição:** Workflow de aprovação com segregação de funções
- **Níveis:**
  1. **Cálculo:** Validação técnica (automático/operador)
  2. **Negócio:** Aprovação comercial (gerente)
  3. **Financeiro:** Aprovação contábil (controller)
  4. **Compliance:** Aprovação regulatória (compliance officer)
- **Segregação:** Quem calcula ≠ quem aprova ≠ quem liquida
- **Prioridade:** Crítica

#### RF-009 - Máquina de Estados
Consulte [Máquina de Estados](./STATE-MACHINE.md) para detalhes completos.

### 2.4 Liquidação Financeira

#### RF-010 - Geração de Settlement Instruction
- **Descrição:** Criar instruções de liquidação para cada participante
- **Conteúdo:** Valor, destino (conta escrow), moeda, data de liquidação
- **Status:** `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`
- **Prioridade:** Crítica

#### RF-011 - Integração com LOWDATAESC
- **Descrição:** Enviar instruções para o Settlement Adapter
- **Protocolo:** gRPC com mTLS
- **Idempotência:** `instruction_id` único por transação
- **Tratamento de erro:** Retry com backoff exponencial
- **Prioridade:** Crítica

#### RF-012 - Confirmação de Liquidação
- **Descrição:** Receber confirmação do LOWDATAESC
- **Validação:** Assinatura digital, hash da instrução
- **Atualização:** Status da instrução e cálculo
- **Prioridade:** Alta

### 2.5 Reconciliação

#### RF-013 - Reconciliação Automática
- **Descrição:** Comparar eventos de receita com liquidações
- **Frequência:** Diária (automática) + sob demanda
- **Tolerância:** 0.01% (configurável)
- **Relatório:** Divergências com evidências
- **Prioridade:** Crítica

#### RF-014 - Tratamento de Divergências
- **Descrição:** Processo para resolver divergências
- **Ações:**
  - Notificação automática
  - Escalonamento para time financeiro
  - Bloqueio de liquidações futuras (se crítico)
- **Prioridade:** Alta

### 2.6 Gerenciamento de Disputas

#### RF-015 - Abertura de Disputa
- **Descrição:** Permitir que participantes abram disputas
- **Causas:**
  - Cálculo incorreto
  - Matriz aplicada errada
  - Evento não reconhecido
  - Liquidação não recebida
- **Prioridade:** Alta

#### RF-016 - Workflow de Disputa
- **Descrição:** Processo estruturado para resolução
- **Etapas:**
  1. **Abertura:** Participante submete disputa com evidências
  2. **Análise:** Time de operações analisa
  3. **Investigação:** Compliance e financeiro investigam
  4. **Decisão:** Aprovação/rejeição com justificativa
  5. **Resolução:** Ajuste ou manutenção do status quo
- **SLA:** 5 dias úteis
- **Prioridade:** Alta

#### RF-017 - Auditoria de Disputas
- **Descrição:** Rastro completo de todas as disputas
- **Armazenamento:** Imutável (S3 WORM)
- **Acesso:** Restrito a compliance e auditoria
- **Prioridade:** Média

---

## 3. Requisitos de Interface

### 3.1 API de Ingestão
- **Endpoint:** `POST /api/v1/revenue-events`
- **Autenticação:** mTLS + JWT
- **Schema:** `revenue_event_v1`
- **Rate limit:** 1000 req/seg (configurável)

### 3.2 API de Consulta
- **Endpoints:**
  - `GET /api/v1/calculations/{id}`
  - `GET /api/v1/settlement-instructions/{id}`
  - `GET /api/v1/reconciliations/{period}`
- **Autorização:** RBAC
- **Filtros:** Por data, status, operação

### 3.3 API de Aprovação
- **Endpoints:**
  - `POST /api/v1/calculations/{id}/approve`
  - `POST /api/v1/calculations/{id}/reject`
- **Autorização:** Baseada em role e segregação
- **Audit:** Log de todas as ações

### 3.4 API de Disputas
- **Endpoints:**
  - `POST /api/v1/disputes`
  - `GET /api/v1/disputes/{id}`
  - `POST /api/v1/disputes/{id}/resolve`
- **Autorização:** Participante ou operador

---

## 4. Requisitos de Segurança

### 4.1 Autenticação
- **mTLS:** Entre serviços internos
- **JWT:** Para APIs externas com OPA policies
- **MFA:** Para aprovadores humanos

### 4.2 Autorização
- **RBAC:** Roles hierárquicos
- **ABAC:** Atributos (operação, valor, tipo)
- **Segregação:** Matriz RACI

### 4.3 Auditoria
- **Trilha imutável:** Todos os eventos e ações
- **Hash chain:** Para verificação de integridade
- **Armazenamento:** S3 com Object Lock

---

## 5. Requisitos de Conformidade

### 5.1 Regulatórios
- **BCB:** Para operações financeiras no Brasil
- **CVM:** Para fundos de investimento
- **SUSEP:** Para seguros
- **ANPD:** Para proteção de dados

### 5.2 Tributários
- **Retenção na fonte:** ISS, PIS/COFINS, IRPJ/CSLL
- **Relatórios:** Por jurisdição

### 5.3 LGPD
- **Base legal:** Por tipo de dado
- **Consentimento:** Registro e gestão
- **RIPD:** Relatório de Impacto

---

## 6. Priorização

| ID | Descrição | Prioridade | Dependências |
|----|-----------|------------|--------------|
| RF-001 | Ingestão de eventos | Crítica | Nenhuma |
| RF-002 | Normalização de dados | Crítica | RF-001 |
| RF-003 | Armazenamento de eventos | Crítica | RF-002 |
| RF-004 | Aplicação de matriz | Crítica | RF-003 |
| RF-005 | Cálculo de deduções | Crítica | RF-004 |
| RF-006 | Arredondamento | Alta | RF-005 |
| RF-007 | Criação de calculation | Crítica | RF-004 |
| RF-008 | Workflow de aprovação | Crítica | RF-007 |
| RF-009 | Máquina de estados | Crítica | RF-007 |
| RF-010 | Settlement instruction | Crítica | RF-008 |
| RF-011 | Integração LOWDATAESC | Crítica | RF-010 |
| RF-012 | Confirmação de liquidação | Alta | RF-011 |
| RF-013 | Reconciliação automática | Crítica | RF-012 |
| RF-014 | Tratamento de divergências | Alta | RF-013 |
| RF-015 | Abertura de disputa | Alta | RF-013 |
| RF-016 | Workflow de disputa | Alta | RF-015 |
| RF-017 | Auditoria de disputas | Média | RF-016 |

---

## 7. Critérios de Aceite

### 7.1 Funcionais
- [ ] Todos os requisitos RF-001 a RF-017 implementados
- [ ] Integração com LOWDATAESC funcional
- [ ] Workflow de aprovação com segregação de funções
- [ ] Reconciliação automática com tolerância configurável
- [ ] Gerenciamento de disputas completo

### 7.2 Não-Funcionais
- [ ] Latência < 100ms para ingestão
- [ ] Throughput > 5000 TPS
- [ ] Disponibilidade > 99.95%
- [ ] RPO < 5 min, RTO < 15 min

### 7.3 Segurança
- [ ] Threat model validado
- [ ] Pentest executado
- [ ] RBAC e segregação implementados
- [ ] Criptografia em trânsito e repouso

### 7.4 Conformidade
- [ ] Parecer jurídico emitido
- [ ] Parecer tributário emitido
- [ ] Avaliação LGPD completa
- [ ] Mapeamento regulatório por jurisdição

---

## 8. Anexos

- [Glossário de Negócio](./GLOSSARY.md)
- [Máquina de Estados](./STATE-MACHINE.md)
- [Dicionário de Dados](../schemas/DATA-DICTIONARY.md)
- [Matriz de Distribuição](../models/DISTRIBUTION-MATRIX.md)
- [Fórmula de Rendimento Distribuível](../accounting/FORMULA-RENDIMENTO.md)

---

**Aprovado por:** _________________________  
**Data:** _______________  
**Versão:** 1.0.0
