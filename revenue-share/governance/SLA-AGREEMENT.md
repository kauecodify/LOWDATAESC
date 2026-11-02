# Service Level Agreement (SLA) - Revenue Share Module
## Versao: 1.0.0 | Data: 2024-11-02 | Classificacao: Confidencial

---

## 1. Introducao

### 1.1 Proposito
Este documento define os **Service Level Agreements (SLAs)** para o modulo Revenue Share, estabelecendo os padroes de performance, disponibilidade, confiabilidade e suporte que devem ser atendidos para garantir operacao em escala internacional conforme padrao TR8.

### 1.2 Escopo
Os SLAs aplicam-se a:
- **Todos os servicos do modulo Revenue Share** (Ingest, Calculation, Workflow, Liquidacao, Reconciliation, Audit Trail, Distribution Matrix)
- **Todas as integracões** (LOWDATAESC, PostgreSQL, Kafka, S3, Vault)
- **Todos os ambientes** (Producao, Staging, Desenvolvimento)
- **Todos os usuarios** (Operacoes internas, Parceiros, Clientess)

### 1.3 Definicoes

| Termo | Definicao |
|-------|-----------|
| **SLA** | Service Level Agreement - Acordo de nivel de servico |
| **SLO** | Service Level Objective - Objetivo de nivel de servico (meta quantitativa) |
| **SLI** | Service Level Indicator - Indicador de nivel de servico (metrica) |
| **RTO** | Recovery Time Objective - Tempo maximo para recuperacao |
| **RPO** | Recovery Point Objective - Perda maxima de dados aceitavel |
| **MTTR** | Mean Time To Repair - Tempo medio para reparo |
| **MTBF** | Mean Time Between Failures - Tempo medio entre falhas |
| **Availability** | Disponibilidade do servico (uptime) |
| **Latency** | Tempo de resposta (p99) |
| **Throughput** | Taxa de processamento (TPS) |

---

## 2. Acordos de Nivel de Servico (SLAs)

### 2.1 SLA de Disponibilidade

#### SLA-AVAIL-001: Disponibilidade Geral do Modulo

| SLI | SLO | SLA | Janela de Medicao | Penalidade |
|-----|-----|-----|-------------------|------------|
| Disponibilidade do modulo Revenue Share | >= 99.95% | >= 99.95% | Mensal | Credito de 5% por 0.01% abaixo |

**Definicao:**
```
Disponibilidade (%) = (Tempo Total - Tempo de Downtime) / Tempo Total * 100
```

**Exclusoes:**
- Manutencao programada (com aviso previo de 72h)
- Falhas em dependencias externas (AWS, LOWDATAESC)
- Ataques DDoS ou de seguranca
- Forca maior (terremotos, inundacoes, etc.)

**Medicao:**
- **Fonte:** Prometheus + Thanos (retencao de 2 anos)
- **Metrica:** `sum(up{namespace="revenue-share"}) by (namespace) / count(up{namespace="revenue-share"}) by (namespace)`
- **Frequencia:** A cada 1 minuto
- **Relatorio:** Mensal (disponibilizado ate o 5o dia util do mes seguinte)

**Alertas:**
- **Warning:** Disponibilidade < 99.98% (por 5 minutos)
- **Critical:** Disponibilidade < 99.95% (por 1 minuto)

---

#### SLA-AVAIL-002: Disponibilidade por Servico

| Servico | SLI | SLO | SLA | Janela |
|---------|-----|-----|-----|--------|
| Ingest Service | Disponibilidade | >= 99.99% | >= 99.99% | Mensal |
| Calculation Service | Disponibilidade | >= 99.95% | >= 99.95% | Mensal |
| Workflow Service | Disponibilidade | >= 99.95% | >= 99.95% | Mensal |
| Liquidacao Service | Disponibilidade | >= 99.99% | >= 99.99% | Mensal |
| Reconciliation Service | Disponibilidade | >= 99.90% | >= 99.90% | Mensal |
| Audit Trail Service | Disponibilidade | >= 99.99% | >= 99.99% | Mensal |
| Distribution Matrix Service | Disponibilidade | >= 99.95% | >= 99.95% | Mensal |

**Justificativa:**
- **Ingest e Liquidacao:** Requerem alta disponibilidade para nao bloquear fluxo de receita
- **Audit Trail:** Imutabilidade e disponibilidade critica para auditoria
- **Reconciliation:** Menos critico (execucao em batch)

---

### 2.2 SLA de Performance

#### SLA-PERF-001: Latencia (Tempo de Resposta)

| Operacao | SLI | SLO | SLA | Percentil | Janela |
|----------|-----|-----|-----|-----------|--------|
| Ingestao de evento | Latencia | <= 50ms | <= 100ms | p99 | Por requisicao |
| Calculo de distribuicao | Duracao | <= 200ms | <= 500ms | p99 | Por requisicao |
| Aprovacao (workflow) | Duracao | <= 100ms | <= 200ms | p99 | Por etapa |
| Liquidacao (LOWDATAESC) | Duracao | <= 300ms | <= 500ms | p99 | Por requisicao |
| Reconciliacao | Duracao | <= 1s | <= 2s | p99 | Por batch |
| Consulta de auditoria | Latencia | <= 100ms | <= 200ms | p99 | Por requisicao |

**Definicoes:**
- **Latencia:** Tempo desde a requisicao ate a primeira resposta (bytes)
- **Duracao:** Tempo total para conclusao da operacao
- **p99:** 99o percentil (99% das requisicoes abaixo deste valor)

**Medicao:**
- **Fonte:** Prometheus (histogramas)
- **Metricas:**
  - `ingest_event_latency_seconds`
  - `calculation_duration_seconds`
  - `approval_duration_seconds`
  - `settlement_duration_seconds`
  - `reconciliation_duration_seconds`
  - `audit_query_latency_seconds`

**Alertas:**
- **Warning:** p99 > 80% do SLO (por 5 minutos)
- **Critical:** p99 > SLO (por 1 minuto)

---

#### SLA-PERF-002: Throughput (Taxa de Processamento)

| Operacao | SLI | SLO | SLA | Janela |
|----------|-----|-----|-----|--------|
| Ingestao de eventos | TPS | >= 4000 | >= 5000 | Por segundo |
| Calculo de distribuicao | TPS | >= 100 | >= 200 | Por segundo |
| Aprovacoes | TPS | >= 50 | >= 100 | Por segundo |
| Liquidacoes | TPS | >= 200 | >= 500 | Por segundo |
| Reconciliacoes | TPS | >= 10 | >= 20 | Por segundo |

**Definicao:**
```
TPS = Requisicoes processadas com sucesso / Segundo
```

**Medicao:**
- **Fonte:** Prometheus (counters)
- **Metricas:**
  - `ingest_events_processed_total`
  - `calculations_completed_total`
  - `approvals_completed_total`
  - `settlements_completed_total`
  - `reconciliations_completed_total`

**Alertas:**
- **Warning:** TPS < 80% do SLO (por 5 minutos)
- **Critical:** TPS < SLO (por 1 minuto)

---

### 2.3 SLA de Confiabilidade

#### SLA-RELIAB-001: Taxa de Erro

| Operacao | SLI | SLO | SLA | Janela |
|----------|-----|-----|-----|--------|
| Ingestao de eventos | Taxa de erro | <= 0.01% | <= 0.1% | Por requisicao |
| Calculo de distribuicao | Taxa de erro | <= 0.1% | <= 1% | Por requisicao |
| Aprovacoes | Taxa de erro | <= 0.01% | <= 0.1% | Por requisicao |
| Liquidacoes | Taxa de erro | <= 0.1% | <= 1% | Por requisicao |
| Reconciliacoes | Taxa de erro | <= 1% | <= 5% | Por batch |

**Definicao:**
```
Taxa de Erro (%) = (Requisicoes com erro / Requisicoes totais) * 100
```

**Tipos de Erro:**
- **Transientes:** Retry automatico (nao contam para SLA)
- **Permanentes:** Requer intervencao manual (contam para SLA)

**Medicao:**
- **Fonte:** Prometheus (counters)
- **Metricas:**
  - `ingest_events_errors_total`
  - `calculation_errors_total`
  - `approval_errors_total`
  - `settlement_errors_total`
  - `reconciliation_errors_total`

---

#### SLA-RELIAB-002: Idempotencia

| SLI | SLO | SLA | Janela |
|-----|-----|-----|--------|
| Taxa de duplicacao | 0% | 0% | Por operacao |

**Definicao:**
```
Taxa de Duplicacao (%) = (Operacoes duplicadas / Operacoes totais) * 100
```

**Requisitos:**
- Todas as operacoes criticas devem ser idempotentes
- Idempotency keys unicos por operacao
- Verificacao automatica de duplicatas

**Medicao:**
- **Fonte:** PostgreSQL (consistencia de dados)
- **Metrica:** `idempotency_violations_total`

**Testes:**
- **Frequencia:** Diario (automático)
- **Cobertura:** 100% das operacoes criticas
- **Evidencia:** [IDEMPOTENCY-TEST-REPORT.md](../tests/IDEMPOTENCY-TEST-REPORT.md)

---

#### SLA-RELIAB-003: Consistencia de Dados

| SLI | SLO | SLA | Janela |
|-----|-----|-----|--------|
| Reconciliacao automatica | 100% | 100% | Diario |
| Divergencias de reconciliação | <= 0.01% | <= 0.1% | Por batch |

**Definicao:**
```
Consistencia (%) = (Eventos reconciliados / Eventos totais) * 100
```

**Requisitos:**
- Reconciliacao automatica diaria
- Divergencias > R$ 0.01 devem ser investigadas
- Divergencias > R$ 1000 requerem aprovacao do CFO

**Medicao:**
- **Fonte:** Reconciliation Service
- **Metrica:** `reconciliation_discrepancies_total`

**Evidencia:**
- [RECONCILIATION-TEST-REPORT.md](../tests/RECONCILIATION-TEST-REPORT.md)

---

### 2.4 SLA de Recuperacao

#### SLA-RECOV-001: Recovery Time Objective (RTO)

| Tipo de Falha | SLI | SLO | SLA | Janela |
|---------------|-----|-----|-----|--------|
| Falha de servico individual | RTO | <= 5m | <= 10m | Por incidente |
| Falha de zona de disponibilidade | RTO | <= 10m | <= 15m | Por incidente |
| Falha de regiao | RTO | <= 15m | <= 30m | Por incidente |
| Falha de dependencia externa | RTO | <= 30m | <= 1h | Por incidente |

**Definicao:**
```
RTO = Tempo maximo aceitavel para restaurar o servico apos uma falha
```

**Medicao:**
- **Fonte:** Incident Reports
- **Metrica:** `incident_rto_seconds`

---

#### SLA-RECOV-002: Recovery Point Objective (RPO)

| Tipo de Falha | SLI | SLO | SLA | Janela |
|---------------|-----|-----|-----|--------|
| Falha de servico individual | RPO | <= 1m | <= 5m | Por incidente |
| Falha de zona de disponibilidade | RPO | <= 5m | <= 10m | Por incidente |
| Falha de regiao | RPO | <= 10m | <= 15m | Por incidente |

**Definicao:**
```
RPO = Perda maxima de dados aceitavel apos uma falha
```

**Implementacao:**
- **PostgreSQL:** WAL archiving a cada 1 minuto
- **Kafka:** Retention de 7 dias (configuravel)
- **S3:** Versionamento + WORM (7 anos)

---

### 2.5 SLA de Suporte

#### SLA-SUPP-001: Tempo de Resposta

| Severidade | SLI | SLO | SLA | Janela |
|------------|-----|-----|-----|--------|
| Critico (P0) | Tempo de resposta | <= 5m | <= 15m | 24/7 |
| Alto (P1) | Tempo de resposta | <= 15m | <= 30m | 24/7 |
| Medio (P2) | Tempo de resposta | <= 1h | <= 2h | Horario comercial |
| Baixo (P3) | Tempo de resposta | <= 4h | <= 8h | Horario comercial |

**Definicoes de Severidade:**
| Severidade | Descricao | Impacto |
|------------|-----------|---------|
| **P0 - Critico** | Sistema inoperante, perda de dados, violacao de seguranca | Impacto total |
| **P1 - Alto** | Funcionalidade critica comprometida, performance degradada | Impacto significativo |
| **P2 - Medio** | Funcionalidade nao-critica comprometida | Impacto moderado |
| **P3 - Baixo** | Perguntas, melhorias, bugs nao-criticos | Impacto minimo |

**Medicao:**
- **Fonte:** Jira Service Desk / PagerDuty
- **Metrica:** `ticket_response_time_seconds`

---

#### SLA-SUPP-002: Tempo de Resolucao

| Severidade | SLI | SLO | SLA | Janela |
|------------|-----|-----|-----|--------|
| Critico (P0) | MTTR | <= 1h | <= 2h | 24/7 |
| Alto (P1) | MTTR | <= 4h | <= 8h | 24/7 |
| Medio (P2) | MTTR | <= 24h | <= 48h | Horario comercial |
| Baixo (P3) | MTTR | <= 72h | <= 168h | Horario comercial |

**Definicao:**
```
MTTR = Tempo medio desde a abertura do ticket ate a resolucao
```

---

## 3. Acordos Internos (Entre Modulos)

### 3.1 SLA entre Servicos do Revenue Share

| Servico Consumidor | Servico Provedor | SLI | SLO | SLA |
|---------------------|------------------|-----|-----|-----|
| Ingest Service | Kafka | Latencia de producao | <= 10ms | <= 20ms |
| Calculation Service | Ingest Service | Disponibilidade | >= 99.99% | >= 99.95% |
| Workflow Service | Calculation Service | Latencia | <= 100ms | <= 200ms |
| Liquidacao Service | Workflow Service | Disponibilidade | >= 99.99% | >= 99.95% |
| Liquidacao Service | LOWDATAESC | Latencia | <= 300ms | <= 500ms |
| Reconciliation Service | Liquidacao Service | Disponibilidade | >= 99.95% | >= 99.90% |
| Audit Trail Service | Todos | Disponibilidade | >= 99.99% | >= 99.95% |

---

### 3.2 SLA com LOWDATAESC

| SLI | SLO | SLA | Janela |
|-----|-----|-----|--------|
| Disponibilidade da API | >= 99.99% | >= 99.95% | Mensal |
| Latencia (p99) | <= 200ms | <= 500ms | Por requisicao |
| Throughput | >= 1000 TPS | >= 500 TPS | Por segundo |
| Taxa de erro | <= 0.01% | <= 0.1% | Por requisicao |
| RTO | <= 5m | <= 15m | Por incidente |
| RPO | <= 1m | <= 5m | Por incidente |

**Penalidades:**
- **Credito:** 10% do valor mensal por cada 0.1% abaixo do SLA
- **Limite:** 100% do valor mensal

---

## 4. Monitoramento e Relatorios

### 4.1 Dashboard de SLAs

**URL:** `https://grafana.internal/dashboard/sla-revenue-share`

**Painéis:**
1. **Disponibilidade** (por servico e geral)
2. **Latencia** (p50, p95, p99 por operacao)
3. **Throughput** (TPS por operacao)
4. **Taxa de Erro** (por operacao)
5. **RTO/RPO** (por incidente)
6. **Tempo de Resposta** (por severidade)
7. **Tempo de Resolucao** (por severidade)

---

### 4.2 Relatorios de SLA

#### Relatorio Diario
**Frequencia:** Diario (08:00 UTC)
**Responsavel:** Operations Manager

```markdown
# Relatorio Diario de SLA - Revenue Share
**Data:** 2024-11-02

## Disponibilidade
| Servico | SLO | Realizado | Status |
|---------|-----|-----------|--------|
| Ingest Service | 99.99% | 100.00% | ✅ |
| Calculation Service | 99.95% | 99.98% | ✅ |
| Workflow Service | 99.95% | 99.97% | ✅ |
| Liquidacao Service | 99.99% | 100.00% | ✅ |
| **Modulo Revenue Share** | **99.95%** | **99.98%** | **✅** |

## Performance
| Operacao | SLO (p99) | Realizado | Status |
|----------|-----------|-----------|--------|
| Ingestao | <= 100ms | 45ms | ✅ |
| Calculo | <= 500ms | 230ms | ✅ |
| Liquidacao | <= 500ms | 320ms | ✅ |

## Throughput
| Operacao | SLO | Realizado | Status |
|----------|-----|-----------|--------|
| Ingestao | >= 5000 TPS | 8500 TPS | ✅ |
| Calculo | >= 200 TPS | 340 TPS | ✅ |
| Liquidacao | >= 500 TPS | 680 TPS | ✅ |

## Incidentes
| ID | Tipo | Severidade | RTO Realizado | RTO SLA | Status |
|----|------|------------|---------------|---------|--------|
| INC-20241102-001 | Kafka Lag | P1 | 5m | 15m | ✅ |
```

---

#### Relatorio Semanal
**Frequencia:** Semanal (Segunda-feira 09:00 UTC)
**Responsavel:** Operations Manager

```markdown
# Relatorio Semanal de SLA - Revenue Share
**Periodo:** 2024-10-28 a 2024-11-03

## Resumo Executivo
- **Disponibilidade Media:** 99.97% (SLA: 99.95%) ✅
- **Latencia Media (p99):** 280ms (SLA: 500ms) ✅
- **Throughput Medio:** 7200 TPS (SLA: 5000 TPS) ✅
- **Taxa de Erro:** 0.02% (SLA: 0.1%) ✅
- **MTTR:** 23 minutos (SLA: 1h para P0) ✅

## Tendencias
- Disponibilidade: ✅ Estavel
- Latencia: ⚠️ Aumento de 15% (investigar)
- Throughput: ✅ Crescimento de 10%

## Incidentes
| ID | Tipo | Severidade | Duracao | RTO | RPO | Causa Raiz |
|----|------|------------|---------|-----|-----|------------|
| INC-20241101-001 | PostgreSQL Slow Query | P1 | 30m | 5m | 1m | Query sem indice |

## Acoes Corretivas
- [x] Adicionado indice para query lenta
- [ ] Investigar aumento de latencia
```

---

#### Relatorio Mensal
**Frequencia:** Mensal (1o dia util 10:00 UTC)
**Responsavel:** Operations Manager

```markdown
# Relatorio Mensal de SLA - Revenue Share
**Mes:** Novembro 2024

## KPIs de SLA
| Metrica | SLO | Realizado | Status | Credito |
|---------|-----|-----------|--------|---------|
| Disponibilidade | >= 99.95% | 99.96% | ✅ | 0% |
| Latencia (p99) | <= 500ms | 320ms | ✅ | 0% |
| Throughput | >= 5000 TPS | 7800 TPS | ✅ | 0% |
| Taxa de Erro | <= 0.1% | 0.03% | ✅ | 0% |
| RTO (P0) | <= 15m | 12m | ✅ | 0% |
| RPO | <= 5m | 3m | ✅ | 0% |
| MTTR (P0) | <= 2h | 45m | ✅ | 0% |

## Analise de Tendencias
- **Disponibilidade:** Estavel em 99.96%
- **Latencia:** Melhora de 20% em relacao ao mes anterior
- **Throughput:** Crescimento de 15% (alinhado com previsao)
- **Incidentes:** Reducao de 30% em relacao ao mes anterior

## Incidentes Criticos
| ID | Tipo | Severidade | Duracao | Impacto | Acao Corretiva | Status |
|----|------|------------|---------|---------|----------------|--------|
| INC-20241115-001 | Falha no Kafka | P0 | 45m | Parada parcial | Aumentar replicas | ✅ Resolvido |

## Creditos Aplicados
- **Total de creditos:** R$ 0.00 (0% do valor mensal)

## Recomendacoes
- [ ] Aumentar capacidade do PostgreSQL para next quarter
- [ ] Implementar cache adicional para calculos
- [ ] Revisar politica de retenção de logs
```

---

### 4.3 Alertas de SLA

**Configuracao Prometheus:**
```yaml
groups:
- name: sla-alerts
  rules:
  
  # Disponibilidade
  - alert: SLADisponibilidadeBaixa
    expr: 1 - (sum(up{namespace="revenue-share"}) by (namespace) / count(up{namespace="revenue-share"}) by (namespace)) > 0.0005
    for: 1m
    labels:
      severity: critical
      sla: availability
    annotations:
      summary: "Disponibilidade do modulo Revenue Share abaixo de 99.95%"
      description: "Disponibilidade atual: {{ $value }}%"
  
  # Latencia
  - alert: SLALatenciaAlta
    expr: histogram_quantile(0.99, sum(rate(calculation_duration_seconds_bucket[5m])) by (le)) > 0.5
    for: 5m
    labels:
      severity: warning
      sla: latency
    annotations:
      summary: "Latencia de calculo acima de 500ms (p99: {{ $value }}s)"
  
  # Throughput
  - alert: SLATHroughputBaixo
    expr: rate(ingest_events_processed_total[5m]) < 5000
    for: 5m
    labels:
      severity: warning
      sla: throughput
    annotations:
      summary: "Throughput de ingestao abaixo de 5000 TPS (atual: {{ $value }} TPS)"
  
  # Taxa de Erro
  - alert: SLATaxaErroAlta
    expr: rate(calculation_errors_total[5m]) / rate(calculations_completed_total[5m]) > 0.001
    for: 5m
    labels:
      severity: critical
      sla: error_rate
    annotations:
      summary: "Taxa de erro de calculo acima de 0.1% (atual: {{ $value }}%)"
```

---

## 5. Processo de Gerenciamento de SLA

### 5.1 Ciclo de Vida do SLA

```
┌─────────────────────────────────────────────────────────────────┐
│                    CICLO DE VIDA DO SLA                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. DEFINICAO                   2. APROVACAO                     │
│     │                              │                      │
│     ▼                              ▼                      │
│  ┌─────────┐                 ┌─────────┐                │
│  │  SLOs   │───────────────▶│ Aprov. │                │
│  │  SLIs   │                 │  CFO   │                │
│  └─────────┘                 └─────────┘                │
│     │                              │                      │
│     ▼                              ▼                      │
│  3. IMPLEMENTACAO              4. MONITORAMENTO                 │
│     │                              │                      │
│     ▼                              ▼                      │
│  ┌─────────┐                 ┌─────────┐                │
│  │ Config. │                 │ Alertas │                │
│  │  Tooling│                 │ Dash.   │                │
│  └─────────┘                 └─────────┘                │
│     │                              │                      │
│     ▼                              ▼                      │
│  5. REVISAO                     6. MELHORIA                     │
│     │                              │                      │
│     ▼                              ▼                      │
│  ┌─────────┐                 ┌─────────┐                │
│  │Relator. │───────────────▶│ Acoes   │                │
│  │  SLA    │                 │ Corret. │                │
│  └─────────┘                 └─────────┘                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Responsabilidades

| Atividade | Responsavel | Frequencia |
|-----------|-------------|------------|
| Definir SLIs/SLOs | Operations Manager + CFO | Trimestral |
| Aprovar SLAs | CFO | Anual |
| Implementar monitoramento | Operations Manager | Conforme necessario |
| Monitorar SLAs | Operations Manager | Diario |
| Reportar SLAs | Operations Manager | Diario/Semanal/Mensal |
| Investigar violacoes | Operations Manager + Time Tecnico | Conforme necessario |
| Implementar melhorias | Time de Engenharia | Conforme necessario |
| Revisar SLAs | Operations Manager + CFO | Trimestral |

---

### 5.3 Processo de Violacao de SLA

```
┌─────────────────────────────────────────────────────────────────┐
│                 PROCESSO DE VIOLACAO DE SLA                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. DETECCAO                      2. NOTIFICACAO                  │
│     │                              │                      │
│     ▼                              ▼                      │
│  ┌─────────┐                 ┌─────────┐                │
│  │ Alerta  │───────────────▶│ Email   │                │
│  │ Prom.   │                 │ Slack   │                │
│  └─────────┘                 └─────────┘                │
│     │                              │                      │
│     ▼                              ▼                      │
│  3. INVESTIGACAO                 4. ESCALONAMENTO                 │
│     │                              │                      │
│     ▼                              ▼                      │
│  ┌─────────┐                 ┌─────────┐                │
│  │ OM      │───────────────▶│ CFO     │                │
│  │ Time    │                 │ CCO     │                │
│  └─────────┘                 └─────────┘                │
│     │                              │                      │
│     ▼                              ▼                      │
│  5. RESOLUCAO                    6. COMUNICACAO                  │
│     │                              │                      │
│     ▼                              ▼                      │
│  ┌─────────┐                 ┌─────────┐                │
│  │ Acao    │                 │ Relat.  │                │
│  │ Corret. │───────────────▶│ Status  │                │
│  └─────────┘                 └─────────┘                │
│     │                              │                      │
│     ▼                              ▼                      │
│  7. ANALISSE                     8. MELHORIA                      │
│     │                              │                      │
│     ▼                              ▼                      │
│  ┌─────────┐                 ┌─────────┐                │
│  │ RCA     │                 │ Plano   │                │
│  │ Post-   │                 │ Acao    │                │
│  │ Mortem  │                 │         │                │
│  └─────────┘                 └─────────┘                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**RCA (Root Cause Analysis):**
- **Prazo:** 5 dias uteis apos resolucao
- **Responsavel:** Operations Manager
- **Conteudo:**
  - Descricao do incidente
  - Cronologia
  - Causa raiz
  - Impacto
  - Acoes corretivas
  - Acoes preventivas

**Plano de Acao:**
- **Prazo:** 10 dias uteis apos RCA
- **Responsavel:** Operations Manager + Time Tecnico
- **Conteudo:**
  - Acoes para prevenir recorrencia
  - Responsaveis
  - Prazos
  - Prioridades

---

### 5.4 Creditos por Violacao de SLA

**Calculo de Creditos:**
```
Credito (%) = (SLA Realizado - SLA Contratado) * Fator de Credito
```

| Servico | Fator de Credito | Limite Mensal |
|---------|------------------|---------------|
| Disponibilidade | 5% por 0.01% abaixo | 100% |
| Latencia | 2% por 10% acima | 50% |
| Throughput | 2% por 10% abaixo | 50% |
| Taxa de Erro | 5% por 0.1% acima | 100% |
| RTO | 10% por 10% acima | 100% |
| RPO | 10% por 10% acima | 100% |

**Exemplo:**
```
Disponibilidade Realizada: 99.90%
Disponibilidade SLA: 99.95%
Diferenca: -0.05%

Credito = (99.95 - 99.90) * 5% * 5 = 0.05 * 500% = 25%
```

**Processo de Credito:**
1. **Detecao:** Violacao identificada via monitoramento
2. **Validacao:** OM valida a violacao
3. **Calculo:** OM calcula o credito
4. **Aprovacao:** CFO aprova o credito
5. **Aplicacao:** Credito aplicado na fatura do mes seguinte
6. **Comunicacao:** Cliente notificado via email

---

## 6. Excecoes e Limitacoes

### 6.1 Excecoes ao SLA

Os seguintes eventos **nao** sao cobertos pelo SLA:

1. **Manutencao Programada:**
   - Avisos com antecedencia minima de 72 horas
   - Janela de manutencao: 02:00 - 06:00 UTC (1o Domingo do mes)
   - Duracao maxima: 4 horas

2. **Dependencias Externas:**
   - Falhas na AWS (EKS, RDS, S3, etc.)
   - Falhas no LOWDATAESC
   - Falhas em servicos de terceiros (Kafka, PostgreSQL, etc.)

3. **Eventos de Forca Maior:**
   - Desastres naturais (terremotos, inundacoes, furacoes, etc.)
   - Ataques terroristas
   - Guerras
   - Pandemias

4. **Acoes do Cliente:**
   - Configuracoes incorretas pelo cliente
   - Uso inadequado da API
   - Violacao dos termos de uso

5. **Causas Externas:**
   - Ataques DDoS
   - Ataques de seguranca
   - Falhas de rede do cliente

### 6.2 Limitacoes

1. **Creditos:**
   - Credito maximo mensal: 100% do valor do servico
   - Creditos nao sao cumulativos
   - Creditos nao sao reembolsaveis em dinheiro

2. **Responsabilidade:**
   - O modulo Revenue Share nao se responsabiliza por:
     - Perda de dados do cliente
     - Lucros cessantes
     - Danos indiretos

3. **Disponibilidade:**
   - O SLA de disponibilidade nao se aplica a:
     - Ambientes de desenvolvimento e staging
     - Servicos em versao beta
     - Funcionalidades experimentais

---

## 7. Termos e Condicoes

### 7.1 Vigencia
- **Inicio:** 2024-11-02
- **Duracao:** Indeterminada
- **Renovacao:** Automatica
- **Cancelamento:** 30 dias de aviso previo

### 7.2 Modificacoes
- Qualquer modificacao neste SLA deve ser:
  1. Proposta por escrito pelo Operations Manager
  2. Revisada pelo CFO e CCO
  3. Aprovada pelo cliente (se aplicavel)
  4. Documentada em nova versao

### 7.3 Disputas
- Disputas relacionadas ao SLA devem ser:
  1. Reportadas ao Operations Manager
  2. Investigadas em ate 5 dias uteis
  3. Resolvidas em ate 10 dias uteis
  4. Escaladas para o CFO se nao resolvidas

### 7.4 Confidencialidade
- Este documento e classificado como **Confidencial**
- Acesso restrito a:
  - Time do Revenue Share (OM, CFO, CCO, ADM)
  - Clientes com contrato de SLA
  - Auditores autorizados

---

## 8. Anexos

### 8.1 Glossario

| Termo | Definicao |
|-------|-----------|
| **SLA** | Service Level Agreement - Acordo de nivel de servico |
| **SLO** | Service Level Objective - Objetivo de nivel de servico |
| **SLI** | Service Level Indicator - Indicador de nivel de servico |
| **RTO** | Recovery Time Objective - Tempo maximo para recuperacao |
| **RPO** | Recovery Point Objective - Perda maxima de dados |
| **MTTR** | Mean Time To Repair - Tempo medio para reparo |
| **MTBF** | Mean Time Between Failures - Tempo medio entre falhas |
| **TPS** | Transactions Per Second - Transacoes por segundo |
| **p99** | 99o percentil - 99% das requisicoes abaixo deste valor |

### 8.2 Referencias

- [RACI-MATRIX.md](./RACI-MATRIX.md) - Matriz de responsabilidades
- [RUNBOOK.md](./RUNBOOK.md) - Procedimentos operacionais
- [INCIDENT-RESPONSE-PLAN.md](./INCIDENT-RESPONSE-PLAN.md) - Plano de resposta a incidentes
- [RNF-REVENUE-SHARE.md](../docs/RNF-REVENUE-SHARE.md) - Requisitos nao-funcionais
- [ARCHITECTURE-REFERENCE.md](../specs/ARCHITECTURE-REFERENCE.md) - Arquitetura tecnica

---

## 9. Controle de Versao

| Versao | Data | Autor | Mudancas | Aprovacao |
|--------|------|-------|----------|-----------|
| 1.0.0 | 2024-11-02 | Vibe Code | Criacao inicial | Pendente |

---

## 10. Aprovacoes

| Role | Nome | Assinatura | Data |
|------|------|------------|------|
| Chief Financial Officer | [CFO Name] | __________ | _____ |
| Chief Compliance Officer | [CCO Name] | __________ | _____ |
| Operations Manager | [OM Name] | __________ | _____ |

---

*Este documento e classificado como **Confidencial** e deve ser armazenado com controle de acesso adequado.*
*Qualquer copia ou distribuicao deve ser autorizada pelo CFO ou OM.*
