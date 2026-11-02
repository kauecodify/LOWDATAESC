# Plano de Resposta a Incidentes - Revenue Share Module
## Versao: 1.0.0 | Data: 2024-11-02 | Classificacao: Confidencial

---

## 1. Introducao

### 1.1 Proposito
Este documento define o **Plano de Resposta a Incidentes** para o modulo Revenue Share, estabelecendo procedimentos claros para detecao, classificacao, resposta, resolucao e pos-mortem de incidentes, garantindo:

- **Minimizacao do impacto** nos negocios e operacoes
- **Recuperacao rapida** dentro dos SLAs (RTO < 15min, RPO < 5min)
- **Comunicacao efetiva** com todas as partes interessadas
- **Aprendizado continuo** atraves de analises pos-incidente
- **Conformidade regulatoria** (BCB, CVM, SUSEP, LGPD)

### 1.2 Escopo
Aplica-se a todos os incidentes que afetem:
- **Servicos do modulo Revenue Share** (Ingest, Calculation, Workflow, Liquidacao, Reconciliation, Audit Trail, Distribution Matrix)
- **Infraestrutura** (Kubernetes, PostgreSQL, Kafka, S3, Vault, Redis)
- **Integracões** (LOWDATAESC, sistemas externos)
- **Seguranca** (violações, acessos nao autorizados, etc.)

### 1.3 Publico Alvo
| Role | Responsabilidade |
|------|------------------|
| **Incident Commander (IC)** | Coordenar resposta ao incidente |
| **Operations Manager (OM)** | Gerenciar escalonamento e comunicacao |
| **On-call Engineer** | Resposta tecnica inicial |
| **Subject Matter Expert (SME)** | Especialista em area especifica |
| **Communications Lead** | Gerenciar comunicacao interna/externamente |
| **Executive Sponsor** | Tomada de decisao estrategica (CFO/CCO) |

### 1.4 Referencias
- [RACI-MATRIX.md](./RACI-MATRIX.md) - Matriz de responsabilidades
- [SLA-AGREEMENT.md](./SLA-AGREEMENT.md) - Acordos de nivel de servico
- [RUNBOOK.md](./RUNBOOK.md) - Procedimentos operacionais
- [THREAT-MODEL.md](../security/THREAT-MODEL.md) - Modelo de ameacas
- [RNF-REVENUE-SHARE.md](../docs/RNF-REVENUE-SHARE.md) - Requisitos nao-funcionais

---

## 2. Definicoes e Classificacao

### 2.1 Definicao de Incidente

**Incidente:** Qualquer evento nao planejado que:
- **Interrompe** ou **degrada** a operacao normal do modulo Revenue Share
- **Ameaca** a seguranca, integridade ou disponibilidade dos dados
- **Viola** os SLAs ou requisito regulatorios
- **Impacta** os usuarios ou clientes

### 2.2 Classificacao de Severidade

| Severidade | Nivel | Descricao | Impacto | RTO Alvo | Comunicacao |
|------------|-------|-----------|---------|----------|-------------|
| **SEV-0** | Critico | Sistema inoperante, perda de dados, violacao de seguranca | **Impacto Total** | <= 5min | Imediata (Phone + PagerDuty) |
| **SEV-1** | Alto | Funcionalidade critica comprometida, performance degradada | **Impacto Significativo** | <= 15min | Imediata (Slack + PagerDuty) |
| **SEV-2** | Medio | Funcionalidade nao-critica comprometida | **Impacto Moderado** | <= 1h | 15min (Slack + Email) |
| **SEV-3** | Baixo | Bugs nao-criticos, melhorias | **Impacto Minimo** | <= 4h | 1h (Email) |

**Matriz de Classificacao:**

| Impacto \\ Urgencia | **Alta** (Imediata) | **Media** (Horas) | **Baixa** (Dias) |
|------------------------|---------------------|-------------------|-------------------|
| **Alto** (Sistema/Receita) | SEV-0 | SEV-1 | SEV-2 |
| **Medio** (Funcionalidade) | SEV-1 | SEV-2 | SEV-3 |
| **Baixo** (Usuario) | SEV-2 | SEV-3 | SEV-3 |

---

### 2.3 Exemplos por Severidade

#### SEV-0 (Critico)
- **Sistema:** Falha total do modulo Revenue Share
- **Dados:** Perda de dados de receita ou liquidacao
- **Seguranca:** Violação de dados (LGPD), acesso nao autorizado a informacoes sensiveis
- **Integracao:** Falha total no LOWDATAESC
- **Infraestrutura:** Falha de regiao AWS (sa-east-1)
- **Compliance:** Violacao de regulacao (BCB, CVM, SUSEP)

#### SEV-1 (Alto)
- **Sistema:** Falha em servico critico (Ingest, Liquidacao)
- **Performance:** Latencia > 1s para operacoes criticas
- **Throughput:** Throughput < 50% do SLA
- **Disponibilidade:** Disponibilidade < 99.9% por > 5min
- **Reconciliacao:** Divergencias nao resolvidas > R$ 10.000
- **Disputas:** Disputa critica nao resolvida (SLA 2h)

#### SEV-2 (Medio)
- **Sistema:** Falha em servico nao-critico (Reconciliation, Audit Trail)
- **Performance:** Latencia > 500ms para operacoes nao-criticas
- **Throughput:** Throughput < 80% do SLA
- **Disponibilidade:** Disponibilidade < 99.95% por > 1h
- **Reconciliacao:** Divergencias nao resolvidas > R$ 1.000
- **Disputas:** Disputa alta nao resolvida (SLA 24h)

#### SEV-3 (Baixo)
- **Sistema:** Bugs visuais ou nao-criticos
- **Performance:** Latencia > SLA para operacoes nao-criticas
- **Throughput:** Throughput < SLA por curto periodo
- **Reconciliacao:** Divergencias nao resolvidas < R$ 1.000
- **Disputas:** Disputa media/baixa nao resolvida
- **Documentacao:** Erros em documentacao

---

## 3. Fluxo de Resposta a Incidentes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLUXO DE RESPOSTA A INCIDENTES                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │   DETECCAO   │────▶│ CLASSIFICACAO│────▶│  RESPOSTA    │                │
│  │              │     │   INICIAL    │     │  INICIAL     │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│          │                    │                    │                         │
│          ▼                    ▼                    ▼                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │  MONITOR     │     │  ALERTA      │     │ INICIAR      │                │
│  │  AUTOMATICO  │     │  MANUAL      │     │ PROCEDIMENTO │                │
│  └──────────────┘     └──────────────┘     │  DE EMERGENCIA│                │
│                                           └──────────────┘                │
│                                                    │                         │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │                        ESCALONAMENTO                              │        │
│  │  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │        │
│  │  │   SEV-0      │────▶│   SEV-1      │────▶│   SEV-2      │    │        │
│  │  │ (Critico)    │     │ (Alto)       │     │ (Medio)      │    │        │
│  │  └──────────────┘     └──────────────┘     └──────────────┘    │        │
│  │                              │                    │                 │        │
│  │                              ▼                    ▼                 │        │
│  │                     ┌──────────────┐     ┌──────────────┐    │        │
│  │                     │   IC + OM    │     │   On-call    │    │        │
│  │                     │   + CFO/CCO  │     │   + OM       │    │        │
│  │                     └──────────────┘     └──────────────┘    │        │
│  └─────────────────────────────────────────────────────────────────┘        │
│                                                    │                         │
│                                                    ▼                         │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │                      INVESTIGACAO E RESOLUCAO                    │        │
│  │                                                                   │        │
│  │  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │        │
│  │  │  DIAGNOSTICO │────▶│  CONTENCAO   │────▶│  RECUPERACAO │    │        │
│  │  │              │     │              │     │              │    │        │
│  │  └──────────────┘     └──────────────┘     └──────────────┘    │        │
│  └─────────────────────────────────────────────────────────────────┘        │
│                                                    │                         │
│                                                    ▼                         │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │                         COMUNICACAO                               │        │
│  │  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │        │
│  │  │ INTERNA      │     │ EXTERNA      │     │ REGULATORIA  │    │        │
│  │  └──────────────┘     └──────────────┘     └──────────────┘    │        │
│  └─────────────────────────────────────────────────────────────────┘        │
│                                                    │                         │
│                                                    ▼                         │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │                      POS-INCIDENTE                               │        │
│  │  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │        │
│  │  │  DOCUMENTACAO│────▶│   RCA        │────▶│ MELHORIAS    │    │        │
│  │  │  (EVIDENCIAS)│     │ (ANALISSE)   │     │ (ACOES)      │    │        │
│  │  └──────────────┘     └──────────────┘     └──────────────┘    │        │
│  └─────────────────────────────────────────────────────────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Procedimentos de Resposta

### 4.1 Detecao e Classificacao Inicial

#### Procedimento: DET-001 - Detecao Automatica
**Trigger:** Alerta do Prometheus/PagerDuty

```bash
# 1. Receber alerta (exemplo)
# [PAGERDUTY] Revenue Share - SEV-1: Disponibilidade < 99.95%
# [SLACK] #incidents: @here SEV-1: Calculation Service com latencia > 500ms

# 2. Acessar dashboard de incidentes
# URL: https://grafana.internal/dashboard/incident-response

# 3. Verificar metrica especifica
kubectl -n revenue-share get pods -l app=calculation-service
kubectl -n revenue-share logs -l app=calculation-service --tail=100 | grep -i error

# 4. Classificar severidade (usar matriz de classificacao)
# SEV-1: Latencia > 500ms para servico critico

# 5. Criar incidente no sistema (Jira/Service Desk)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Calculation Service com latencia elevada",
    "severity": "SEV-1",
    "description": "Latencia p99 > 500ms por 5 minutos",
    "source": "Prometheus Alert",
    "detected_at": "2024-11-02T10:00:00Z",
    "assigned_to": "oncall-engineer"
  }' \
  https://jira.company.com/rest/api/2/issue
```

**Acoes automaticas:**
- Notificar On-call Engineer (PagerDuty)
- Notificar canal #incidents no Slack
- Criar ticket no Jira com template de incidente

---

#### Procedimento: DET-002 - Detecao Manual
**Trigger:** Reportado por usuario ou monitoramento humano

```bash
# 1. Receber report (email, Slack, phone)
# Exemplo: "Nao consigo processar liquidacoes"

# 2. Coletar informacoes iniciais
# - Quem reportou? (usuario, cliente, parceiro)
# - Quando começou?
# - Qual o impacto?
# - Ha erros visiveis?

# 3. Verificar status dos servicos
curl -k https://ingest-service.revenue-share.svc.cluster.local:8443/health
curl -k https://calculation-service.revenue-share.svc.cluster.local:8443/health
curl -k https://liquidacao-service.revenue-share.svc.cluster.local:8443/health

# 4. Classificar severidade
# SEV-1: Liquidacao nao funciona (funcionalidade critica)

# 5. Criar incidente
# (Mesmo procedimento do DET-001)
```

---

### 4.2 Resposta Inicial

#### Procedimento: RESP-001 - Resposta SEV-0 (Critico)
**Incident Commander:** CFO ou CCO
**Time:** On-call Engineer + OM + SMEs

```bash
# 1. Ativar Incident Commander (IC)
# - CFO ou CCO assume o papel de IC
# - IC coordena todas as acoes

# 2. Ativar War Room
# - Criar canal dedicado no Slack: #incident-sev0-<ID>
# - Adicionar: IC, OM, On-call, SMEs, Communications Lead
# - Iniciar chamadas de voz (Zoom/Teams) se necessario

# 3. Executar procedimentos de emergencia
# - Verificar [RUNBOOK.md](./RUNBOOK.md) para procedimentos especificos
# - Executar SOP-EMR-001 (Failover) se necessario
# - Executar SOP-EMR-002 (Restore) se necessario

# 4. Comunicacao inicial (dentro de 5min)
# - Notificar executivos (CFO, CCO, CEO)
# - Notificar clientes afetados (se aplicavel)
# - Template: "Incidente SEV-0 detectado. Time de resposta ativado. Mais informacoes em 15min."

# 5. Documentar acoes
# - Registrar todas as acoes no ticket do Jira
# - Salvar logs e evidencias
```

**Checklist SEV-0:**
- [ ] Incident Commander designado
- [ ] War Room criada
- [ ] Procedimentos de emergencia executados
- [ ] Comunicacao inicial enviada
- [ ] Stakeholders notificados
- [ ] Evidencias sendo coletadas

---

#### Procedimento: RESP-002 - Resposta SEV-1 (Alto)
**Incident Commander:** OM
**Time:** On-call Engineer + SMEs

```bash
# 1. Ativar Incident Commander (IC)
# - OM assume o papel de IC

# 2. Criar canal no Slack: #incident-sev1-<ID>
# - Adicionar: IC, On-call, SMEs

# 3. Executar diagnostico inicial
# - Verificar logs dos servicos afetados
# - Verificar metricas no Grafana
# - Verificar dependencias (PostgreSQL, Kafka, LOWDATAESC)

# 4. Comunicacao inicial (dentro de 15min)
# - Notificar OM e CFO
# - Template: "Incidente SEV-1 detectado. Investigando. Proxima atualizacao em 30min."

# 5. Documentar acoes
# - Registrar no Jira
```

**Checklist SEV-1:**
- [ ] Incident Commander designado
- [ ] Canal de comunicacao criado
- [ ] Diagnostico inicial executado
- [ ] Comunicacao inicial enviada
- [ ] Evidencias sendo coletadas

---

#### Procedimento: RESP-003 - Resposta SEV-2 (Medio)
**Incident Commander:** On-call Engineer
**Time:** On-call + SME (se necessario)

```bash
# 1. On-call Engineer assume investigacao

# 2. Criar ticket no Jira (se nao criado)

# 3. Executar diagnostico
# - Verificar logs
# - Verificar metricas
# - Testar funcionalidades

# 4. Comunicacao inicial (dentro de 1h)
# - Notificar OM
# - Template: "Incidente SEV-2 detectado. Em investigacao. Atualizacao em 2h."

# 5. Documentar acoes
```

**Checklist SEV-2:**
- [ ] Ticket criado no Jira
- [ ] Diagnostico executado
- [ ] OM notificado
- [ ] Evidencias coletadas

---

#### Procedimento: RESP-004 - Resposta SEV-3 (Baixo)
**Responsavel:** On-call Engineer ou SME

```bash
# 1. Investigar durante horario comercial

# 2. Criar ticket no Jira

# 3. Documentar e resolver

# 4. Notificar OM na resolucao
```

---

### 4.3 Escalonamento

#### Procedimento: ESC-001 - Escalonamento Automatico
**Trigger:** Timeout sem resolucao

| Severidade | Timeout | Acao |
|------------|---------|------|
| SEV-0 | 5min | Escalar para CFO/CCO |
| SEV-1 | 30min | Escalar para OM |
| SEV-2 | 2h | Escalar para OM |
| SEV-3 | 4h | Escalar para OM |

```bash
# 1. Verificar tempo decorrido
# - SEV-0: Se > 5min sem resolucao, escalar

# 2. Notificar nivel superior
# - SEV-0: Notificar CFO/CCO
# - SEV-1: Notificar OM
# - SEV-2: Notificar OM

# 3. Atualizar ticket
# - Adicionar comentario: "Escalado para <Role> apos <Timeout> sem resolucao"
```

---

#### Procedimento: ESC-002 - Escalonamento Manual
**Trigger:** Necessidade de expertise adicional

```bash
# 1. Identificar area de especialidade necessaria
# - Exemplo: Problema no PostgreSQL -> SME de Banco de Dados

# 2. Notificar SME
# - @<SME> no Slack
# - Email para <SME>@company.com

# 3. Adicionar SME ao canal de incidente

# 4. Atualizar ticket
# - Adicionar SME como "Consultado"
```

---

### 4.4 Investigacao e Resolucao

#### Procedimento: INV-001 - Diagnostico

```bash
# 1. Coletar informacoes basicas
# - Quando o incidente começou?
# - Quais servicos sao afetados?
# - Qual o impacto?
# - Ha padroes? (horario, tipo de operacao, etc.)

# 2. Verificar logs
kubectl -n revenue-share logs -l app=<SERVICE> --tail=1000 > incident_<ID>_logs.txt

# 3. Verificar metricas
# - Acessar Grafana: https://grafana.internal/dashboard/incident-analysis
# - Filtrar por periodo do incidente

# 4. Verificar dependencias
# - PostgreSQL: kubectl -n revenue-share exec -it postgres-0 -- psql -U postgres -c "SELECT * FROM pg_stat_activity;"
# - Kafka: kubectl -n revenue-share run kafka-check --image=confluentinc/cp-kafka:7.0.0 -- kafka-topics --bootstrap-server kafka:9092 --describe
# - LOWDATAESC: curl -k https://lowdataesc.internal/health

# 5. Testar hipoteses
# - Reproduzir o problema em ambiente de teste
# - Verificar se e problema de configuracao, codigo, infraestrutura, etc.

# 6. Documentar achados
# - Adicionar ao ticket do Jira
```

---

#### Procedimento: INV-002 - Contencao

```bash
# 1. Identificar causa raiz (se possivel)

# 2. Implementar solucao temporaria (workaround)
# - Exemplo: Reiniciar pod
kubectl -n revenue-share delete pod <POD_NAME>

# - Exemplo: Escalar servico
kubectl -n revenue-share scale deployment <SERVICE> --replicas=5

# - Exemplo: Desabilitar funcionalidade problematica
kubectl -n revenue-share patch configmap <CONFIG> -p '{"data":{"DISABLE_FEATURE_X":"true"}}'

# 3. Verificar se contencao funcionou
# - Monitorar metricas
# - Verificar logs

# 4. Documentar contencao
# - Adicionar ao ticket: "Contencao: <Acao>. Resultado: <Efeito>"
```

---

#### Procedimento: INV-003 - Recuperacao

```bash
# 1. Implementar solucao permanente
# - Aplicar patch
# - Corrigir configuracao
# - Deployar nova versao

# 2. Verificar recuperacao
# - Executar testes de validacao
# - Verificar metricas
# - Verificar logs

# 3. Confirmar resolucao
# - IC confirma que o incidente esta resolvido
# - Atualizar status do ticket para "Resolvido"

# 4. Documentar resolucao
# - Adicionar ao ticket: "Resolucao: <Acao>. Verificado: <Metricas>"
```

---

### 4.5 Comunicacao

#### Procedimento: COMM-001 - Comunicacao Interna

**Matriz de Comunicacao Interna:**

| Severidade | Audiencia | Canal | Frequencia | Responsavel |
|------------|-----------|-------|------------|-------------|
| SEV-0 | Todos (Time + Executivos) | Slack (#incidents) + Email + Phone | Imediata + a cada 15min | IC |
| SEV-1 | Time Tecnico + OM + CFO | Slack (#incidents) + Email | Imediata + a cada 30min | IC |
| SEV-2 | Time Tecnico + OM | Slack + Email | Imediata + a cada 1h | IC |
| SEV-3 | Time Tecnico | Email | Diario | On-call |

**Templates de Comunicacao:**

**SEV-0 - Inicial:**
```
Assunto: [SEV-0] Incidente Critico - Revenue Share Module

Prezados,

Um incidente critico (SEV-0) foi detectado no modulo Revenue Share as <HORA>.

Descricao: <DESCRICAO>
Impacto: <IMPACTO>
Servicos Afetados: <SERVICOS>

Time de resposta foi ativado e esta trabalhando na resolucao.

Proxima atualizacao: <HORA> (+15min)

Atenciosamente,
<IC NAME>
Incident Commander
```

**SEV-0 - Atualizacao:**
```
Assunto: [SEV-0] Atualizacao - Incidente #<ID>

Prezados,

Atualizacao do incidente SEV-0 #<ID>:

Status: <STATUS> (Investigando/Contendo/Resolvendo)
Acoes Realizadas: <ACOES>
Proximas Acoes: <PROXIMAS>

Proxima atualizacao: <HORA>

Atenciosamente,
<IC NAME>
```

**SEV-0 - Resolucao:**
```
Assunto: [SEV-0] RESOLVIDO - Incidente #<ID>

Prezados,

O incidente SEV-0 #<ID> foi resolvido as <HORA>.

Causa Raiz: <CAUSA>
Solucao: <SOLUCAO>
Impacto Total: <IMPACTO>

Uma analise detalhada sera realizada e o relatorio sera compartilhado.

Atenciosamente,
<IC NAME>
```

---

#### Procedimento: COMM-002 - Comunicacao Externa

**Matriz de Comunicacao Externa:**

| Severidade | Audiencia | Canal | Frequencia | Responsavel |
|------------|-----------|-------|------------|-------------|
| SEV-0 | Clientes Afetados | Email + Phone + Status Page | Imediata + a cada 30min | Communications Lead |
| SEV-1 | Clientes Afetados | Email + Status Page | Imediata + a cada 1h | Communications Lead |
| SEV-2 | Clientes Afetados | Status Page | Diario | Communications Lead |
| SEV-3 | Nao aplicavel | - | - | - |

**Templates de Comunicacao Externa:**

**SEV-0 - Inicial (Clientes):**
```
Assunto: [URGENTE] Incidente no Servico Revenue Share

Prezado <CLIENTE>,

Estamos cientes de um incidente critico que esta afetando o servico Revenue Share.

Nosso time tecnico esta trabalhando para resolver o problema o mais rapido possivel.

Servicos Afetados: <SERVICOS>
Impacto: <IMPACTO>

Atualizacoes serao fornecidas a cada 30 minutos.

Pedimos desculpas pelo inconveniente.

Atenciosamente,
Equipe Revenue Share
```

**SEV-0 - Atualizacao (Status Page):**
```
Titulo: Incidente em Andamento - Revenue Share

Status: Investigando
Descricao: Estamos investigando um problema que afeta o modulo Revenue Share.

Inicio: <HORA>
Ultima Atualizacao: <HORA>

Servicos Afetados:
- Liquidacao
- Calculo

Proxima Atualizacao: <HORA>
```

**SEV-0 - Resolucao (Status Page):**
```
Titulo: RESOLVIDO - Incidente Revenue Share

Status: Resolvido
Descricao: O incidente foi resolvido. Todos os servicos estao operando normalmente.

Inicio: <HORA>
Fim: <HORA>
Duracao: <DURACAO>

Causa: <CAUSA>
Solucao: <SOLUCAO>
```

---

#### Procedimento: COMM-003 - Comunicacao Regulatoria

**Trigger:** Incidentes que afetem conformidade regulatoria (BCB, CVM, SUSEP, ANPD, LGPD)

**Audiencia:**
- **BCB:** Incidentes que afetem sistema de pagamentos
- **CVM:** Incidentes que afetem mercado de capitais
- **SUSEP:** Incidentes que afetem seguros
- **ANPD:** Incidentes que afetem dados pessoais (LGPD)

**Responsavel:** Chief Compliance Officer (CCO)

**Prazo:**
- **Notificacao Inicial:** 2 horas (para incidentes SEV-0/SEV-1)
- **Relatorio Completo:** 72 horas

**Template de Notificacao:**
```
Assunto: Notificacao de Incidente - Revenue Share Module

Prezados Senhores,

Conforme estabelecido na regulamentacao <REGULACAO>, informamos a ocorrencia de um incidente no modulo Revenue Share.

Data e Hora: <DATA_HORA>
Severidade: <SEVERIDADE>
Descricao: <DESCRICAO>

Medidas Tomadas:
- <MEDIDA_1>
- <MEDIDA_2>

Impacto:
- <IMPACTO_1>
- <IMPACTO_2>

O relatorio completo sera encaminhado em ate 72 horas.

Atenciosamente,
<CCO NAME>
Chief Compliance Officer
```

---

### 4.6 Pos-Incidente

#### Procedimento: POST-001 - Documentacao e Evidencias

```bash
# 1. Coletar todas as evidencias
# - Logs de todos os servicos afetados
# - Metricas do Grafana (exportar para PDF)
# - Screenshots de dashboards
# - Gravacoes de chamadas (se aplicavel)
# - Emails e mensagens do Slack

# 2. Organizar evidencias
mkdir -p incident_<ID>/{logs,metrics,screenshots,communications}

# 3. Salvar em repositorio seguro
# - S3: s3://revenue-share-incidents/<YEAR>/<MONTH>/incident_<ID>/
# - Retencao: 7 anos (conformidade regulatoria)

# 4. Atualizar ticket do Jira
# - Adicionar todas as evidencias como anexos
# - Marcar como "Evidencias Coletadas"
```

---

#### Procedimento: POST-002 - Analise de Causa Raiz (RCA)

**Responsavel:** Incident Commander (com apoio do OM)
**Prazo:** 5 dias uteis apos resolucao

**Metodologia:** 5 Whys

**Template RCA:**
```markdown
# Analise de Causa Raiz - Incidente #<ID>

## 1. Resumo do Incidente
- **Data:** <DATA>
- **Hora:** <HORA>
- **Duracao:** <DURACAO>
- **Severidade:** <SEVERIDADE>
- **Impacto:** <IMPACTO>
- **Servicos Afetados:** <SERVICOS>

## 2. Cronologia
| Hora | Evento | Responsavel |
|------|--------|-------------|
| <HORA> | Incidente detectado | <RESPONSAVEL> |
| <HORA> | War Room ativada | <RESPONSAVEL> |
| <HORA> | Contencao implementada | <RESPONSAVEL> |
| <HORA> | Incidente resolvido | <RESPONSAVEL> |

## 3. Causa Raiz

### Analise 5 Whys
1. **Por que o incidente ocorreu?**
   - R: <RESPOSTA_1>
2. **Por que <RESPOSTA_1>?**
   - R: <RESPOSTA_2>
3. **Por que <RESPOSTA_2>?**
   - R: <RESPOSTA_3>
4. **Por que <RESPOSTA_3>?**
   - R: <RESPOSTA_4>
5. **Por que <RESPOSTA_4>?**
   - R: **<CAUSA_RAIZ>**

**Causa Raiz:** <CAUSA_RAIZ>

## 4. Fatores Contribuintes
- [ ] Falha de hardware
- [ ] Falha de software
- [ ] Erro humano
- [ ] Falha de processo
- [ ] Falha de configuracao
- [ ] Ataque externo
- [ ] Outro: <ESPECIFICAR>

## 5. Impacto

### Impacto Operacional
- **Tempo de inatividade:** <DURACAO>
- **Servicos afetados:** <SERVICOS>
- **Usuarios afetados:** <USUARIOS>
- **Transacoes perdidas:** <TRANSACOES>

### Impacto Financeiro
- **Perda de receita:** R$ <VALOR>
- **Custo de recuperacao:** R$ <VALOR>
- **Multas regulatorias:** R$ <VALOR> (se aplicavel)

### Impacto de Reputacao
- [ ] Nenhum
- [ ] Baixo (internamente)
- [ ] Medio (clientes notificados)
- [ ] Alto (midia envolvida)

## 6. Acoes Corretivas

### Acoes Imediatas (ja implementadas)
| Acao | Responsavel | Data | Status |
|------|-------------|------|--------|
| <ACAO> | <RESPONSAVEL> | <DATA> | ✅/❌ |

### Acoes Preventivas (a implementar)
| Acao | Responsavel | Prazo | Prioridade |
|------|-------------|-------|------------|
| <ACAO> | <RESPONSAVEL> | <PRAZO> | Alta/Media/Baixa |

## 7. Licoes Aprendidas
- [ ] <LICAO_1>
- [ ] <LICAO_2>
- [ ] <LICAO_3>

## 8. Recomendacoes
- [ ] <RECOMENDACAO_1>
- [ ] <RECOMENDACAO_2>
```

---

#### Procedimento: POST-003 - Plano de Acao

**Responsavel:** Operations Manager
**Prazo:** 10 dias uteis apos RCA

**Template Plano de Acao:**
```markdown
# Plano de Acao - Incidente #<ID>

## 1. Contexto
- **Incidente:** #<ID>
- **Data:** <DATA>
- **Causa Raiz:** <CAUSA>

## 2. Acoes Preventivas

| ID | Acao | Responsavel | Prazo | Prioridade | Status |
|----|------|-------------|-------|------------|--------|
| PA-001 | Implementar monitoramento adicional para <METRICA> | OM | <DATA> | Alta | ⬜ |
| PA-002 | Atualizar documentacao do <PROCEDIMENTO> | <RESPONSAVEL> | <DATA> | Alta | ⬜ |
| PA-003 | Treinar time em <TOPICO> | OM | <DATA> | Media | ⬜ |
| PA-004 | Revisar processo de <PROCESSO> | <RESPONSAVEL> | <DATA> | Media | ⬜ |

## 3. Acompanhamento
- **Reuniao de Review:** <DATA>
- **Responsavel pelo Acompanhamento:** <RESPONSAVEL>
- **Frequencia de Atualizacao:** Semanal

## 4. Metricas de Sucesso
- [ ] Reducao de <X>% em incidentes similares
- [ ] Tempo de detecao < <TEMPO>
- [ ] Tempo de resolucao < <TEMPO>
```

---

#### Procedimento: POST-004 - Reuniao de Review

**Participantes:**
- Incident Commander
- Operations Manager
- Chief Compliance Officer (se aplicavel)
- Chief Financial Officer (se aplicavel)
- Time Tecnico envolvido
- Communications Lead (se aplicavel)

**Agenda:**
1. **Abertura** (5min) - OM
2. **Resumo do Incidente** (10min) - IC
3. **Causa Raiz** (10min) - IC
4. **Acoes Corretivas** (10min) - IC
5. **Plano de Acao** (15min) - OM
6. **Discussao e Feedback** (20min) - Todos
7. **Aprovacao do Plano** (10min) - OM
8. **Encerramento** (5min) - OM

**Ata da Reuniao:**
```markdown
# Ata de Reuniao de Review - Incidente #<ID>

## 1. Informacoes da Reuniao
- **Data:** <DATA>
- **Hora:** <HORA>
- **Local:** <LOCAL>
- **Participantes:** <LISTA>

## 2. Resumo do Incidente
- **Incidente:** #<ID>
- **Data:** <DATA>
- **Severidade:** <SEVERIDADE>
- **Impacto:** <IMPACTO>

## 3. Causa Raiz
<CAUSA_RAIZ>

## 4. Acoes Corretivas
- [ ] <ACAO_1>
- [ ] <ACAO_2>

## 5. Plano de Acao Aprovado
| ID | Acao | Responsavel | Prazo | Prioridade |
|----|------|-------------|-------|------------|
| <ID> | <ACAO> | <RESPONSAVEL> | <PRAZO> | <PRIORIDADE> |

## 6. Decisoes
- [ ] <DECISAO_1>
- [ ] <DECISAO_2>

## 7. Proximos Passos
- [ ] <PROXIMO_1>
- [ ] <PROXIMO_2>

## 8. Acoes
| Acao | Responsavel | Prazo |
|------|-------------|-------|
| Enviar ata | <RESPONSAVEL> | <DATA> |
| Implementar PA-001 | <RESPONSAVEL> | <DATA> |
```

---

## 5. Procedimentos Especificos por Tipo de Incidente

### 5.1 Incidentes de Seguranca

#### Procedimento: SEC-001 - Resposta a Violacao de Dados
**Trigger:** Suspeita ou confirmacao de violacao de dados (LGPD)

```bash
# 1. Isolar sistemas afetados
kubectl -n revenue-share patch networkpolicy default-deny -p '{"spec":{"podSelector":{"matchLabels":{"app":"<SERVICE>"}}}}}'

# 2. Preservar evidencias
# - NAO deletar logs
# - NAO reiniciar servicos
# - Fazer snapshot de discos

# 3. Notificar CCO (imediatamente)
# - Phone + Email + Slack

# 4. Ativar procedimento de resposta a incidentes de seguranca
# - Ver [THREAT-MODEL.md](../security/THREAT-MODEL.md)

# 5. Notificar ANPD (em ate 2 horas)
# - Usar template COMM-003
```

**Acoes Adicionais:**
- **Rotacao de chaves:** SOP-SEC-001
- **Bloqueio de usuarios:** SOP-SEC-002
- **Auditoria completa:** Verificar todos os acessos suspeitos

---

#### Procedimento: SEC-002 - Resposta a Ataque DDoS
**Trigger:** Detecao de ataque DDoS

```bash
# 1. Ativar protecao DDoS (AWS Shield)
aws shield create-protection --name revenue-share-ddos-protection --resource-arn <ARN>

# 2. Configurar WAF
aws wafv2 create-web-acl --name revenue-share-acl --scope REGIONAL --default-action Allow={} --visibility-config SampledRequestsEnabled=true,CloudWatchMetricsEnabled=true,MetricName=revenue-share-acl

# 3. Escalar servicos
kubectl -n revenue-share scale deployment ingest-service --replicas=10

# 4. Notificar AWS Support
# - Abrir ticket de emergencia

# 5. Notificar CCO e CFO
```

---

### 5.2 Incidentes de Integracao

#### Procedimento: INT-001 - Falha no LOWDATAESC
**Trigger:** LOWDATAESC inacessivel ou com falhas

```bash
# 1. Verificar status do LOWDATAESC
curl -k https://lowdataesc.internal/health

# 2. Verificar logs de integracao
kubectl -n revenue-share logs -l app=liquidacao-service --tail=100 | grep -i lowdataesc

# 3. Verificar metricas de liquidacao
kubectl -n revenue-share exec -it prometheus-0 -- \
  wget -qO- "http://localhost:9090/api/v1/query?query=rate(settlement_failures_total[5m])"

# 4. Contencao: Desabilitar liquidacoes automaticas
kubectl -n revenue-share patch configmap liquidacao-config -p '{"data":{"AUTO_SETTLE":"false"}}'

# 5. Notificar time do LOWDATAESC
# - Phone: +55 11 99999-9999
# - Email: support@lowdataesc.com

# 6. Ativar modo de degradacao
# - Ver SOP-EMR-003
```

---

#### Procedimento: INT-002 - Falha no Kafka
**Trigger:** Kafka inacessivel ou com lag excessivo

```bash
# 1. Verificar status do Kafka
kubectl -n revenue-share get pods -l app=kafka

# 2. Verificar lag dos consumidores
kubectl -n revenue-share run kafka-lag-check --image=confluentinc/cp-kafka:7.0.0 -- \
  kafka-consumer-groups --bootstrap-server kafka:9092 --describe

# 3. Verificar logs do Kafka
kubectl -n revenue-share logs -l app=kafka --tail=100

# 4. Contencao: Aumentar replicas
kubectl -n revenue-share scale statefulset kafka --replicas=5

# 5. Contencao: Reiniciar brokers
kubectl -n revenue-share rollout restart statefulset kafka

# 6. Notificar OM e CFO
```

---

#### Procedimento: INT-003 - Falha no PostgreSQL
**Trigger:** PostgreSQL inacessivel ou lento

```bash
# 1. Verificar status do PostgreSQL
kubectl -n revenue-share get pods -l app=postgres

# 2. Verificar conexoes
kubectl -n revenue-share exec -it postgres-0 -- \
  psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# 3. Verificar queries lentas
kubectl -n revenue-share exec -it postgres-0 -- \
  psql -U postgres -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state = 'active' ORDER BY duration DESC LIMIT 10;"

# 4. Contencao: Reiniciar replica
kubectl -n revenue-share delete pod postgres-1

# 5. Contencao: Failover para replica
kubectl -n revenue-share patch service postgres -p '{"spec":{"selector":{"statefulset.kubernetes.io/pod-name":"postgres-1"}}}'

# 6. Notificar OM e CFO
```

---

### 5.3 Incidentes de Dados

#### Procedimento: DATA-001 - Divergencia de Reconciliacao Critica
**Trigger:** Divergencia > R$ 10.000 nao resolvida

```bash
# 1. Verificar divergencias
curl -H "Authorization: Bearer $TOKEN" \
  "https://reconciliation-service.revenue-share.svc.cluster.local:8443/api/v1/reconciliations?status=OPEN&severity=CRITICAL"

# 2. Verificar detalhes da divergencia
curl -H "Authorization: Bearer $TOKEN" \
  https://reconciliation-service.revenue-share.svc.cluster.local:8443/api/v1/reconciliations/<ID>/discrepancies/<DISCREPANCY_ID>

# 3. Verificar hash chain
curl -H "Authorization: Bearer $TOKEN" \
  https://audit-service.revenue-share.svc.cluster.local:8443/api/v1/audit/verify?calculation_id=<ID>

# 4. Bloquear liquidacoes para calculos afetados
kubectl -n revenue-share patch configmap liquidacao-config -p '{"data":{"BLOCKED_CALCULATIONS":"<ID_1>,<ID_2>"}}'

# 5. Notificar CFO e FC
# - Phone + Email + Slack

# 6. Escalar para DI (Dispute Investigator)
```

---

#### Procedimento: DATA-002 - Perda de Dados
**Trigger:** Dados perdidos ou corrompidos

```bash
# 1. Verificar backup mais recente
aws s3 ls s3://revenue-share-backups/postgres/ --recursive | sort | tail -1

# 2. Verificar integridade do backup
kubectl -n revenue-share exec -it postgres-0 -- \
  pg_restore -U postgres -d revenue_share_test -C -v /backups/revenue-share-2024-11-02T00-00-00.sql 2>&1 | grep -i error

# 3. Restaurar backup (se necessario)
# - Ver SOP-EMR-002

# 4. Verificar hash chain para consistencia
curl -X POST -H "Authorization: Bearer $TOKEN" \
  https://audit-service.revenue-share.svc.cluster.local:8443/api/v1/audit/verify-all

# 5. Notificar CFO, CCO e OM
# - Phone + Email + Slack

# 6. Ativar procedimento de recuperacao de dados
```

---

## 6. Ferramentas e Recursos

### 6.1 Ferramentas de Monitoramento

| Ferramenta | URL | Uso |
|------------|-----|-----|
| Prometheus | https://prometheus.internal | Metricas |
| Grafana | https://grafana.internal | Dashboards |
| Alertmanager | https://alertmanager.internal | Alertas |
| PagerDuty | https://pagerduty.com | Notificacoes |
| Slack | https://slack.com | Comunicacao |
| Jira | https://jira.company.com | Rastreamento |

---

### 6.2 Ferramentas de Resposta

| Ferramenta | Uso |
|------------|-----|
| kubectl | Gerenciamento do Kubernetes |
| psql | Acesso ao PostgreSQL |
| kafka-consumer-groups | Verificacao de lag do Kafka |
| curl | Testes de API |
| aws cli | Gerenciamento da AWS |
| vault | Gerenciamento de segredos |

---

### 6.3 Scripts de Emergencia

**Script: Verificar Saude de Todos os Servicos**
```bash
#!/bin/bash
SERVICES=("ingest-service" "calculation-service" "workflow-service" "liquidacao-service" "reconciliation-service" "audit-service" "matrix-service")

for service in "${SERVICES[@]}"; do
  echo "=== $service ==="
  kubectl -n revenue-share get pods -l app=$service
  curl -k -s -o /dev/null -w "Health: %{http_code}\n" https://$service.revenue-share.svc.cluster.local:8443/health
  echo ""
done
```

**Script: Verificar Espaco em Disco**
```bash
#!/bin/bash
kubectl -n revenue-share exec -it postgres-0 -- df -h
kubectl -n revenue-share exec -it kafka-0 -- df -h
```

**Script: Verificar Conexoes de Banco de Dados**
```bash
#!/bin/bash
kubectl -n revenue-share exec -it postgres-0 -- \
  psql -U postgres -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"
```

---

## 7. Treinamento e Simulados

### 7.1 Treinamento do Time

| Treinamento | Frequencia | Publico Alvo | Responsavel |
|-------------|------------|--------------|-------------|
| Procedimentos de Resposta a Incidentes | Trimestral | Todo o time | OM |
| Uso das Ferramentas (Prometheus, Grafana, etc.) | Mensal | On-call Engineers | OM |
| Simulados de Incidentes | Trimestral | Todo o time | OM |
| Treinamento de Seguranca | Anual | Todo o time | CCO |
| Treinamento de Conformidade | Anual | Todo o time | CCO |

---

### 7.2 Simulados de Incidentes

**Objetivo:** Testar a prontidao do time para responder a incidentes reais.

**Frequencia:** Trimestral

**Tipos de Simulados:**
1. **Failover de Regiao:** Simular falha na regiao primaria
2. **Ataque de Seguranca:** Simular violacao de dados
3. **Falha no LOWDATAESC:** Simular indisponibilidade do LOWDATAESC
4. **Divergencia de Reconciliacao:** Simular divergencia critica
5. **Falha no Kafka:** Simular lag excessivo no Kafka

**Procedimento:**
1. **Planejamento:** OM define cenarios e objetivos
2. **Executacao:** Time responde como se fosse um incidente real
3. **Avaliacao:** OM avalia a resposta do time
4. **Melhorias:** Identificar gaps e implementar melhorias

**Metricas de Sucesso:**
- Tempo de detecao
- Tempo de classificacao
- Tempo de resposta inicial
- Tempo de resolucao
- Comunicacao efetiva
- Documentacao completa

---

## 8. Controle de Versao

| Versao | Data | Autor | Mudancas |
|--------|------|-------|----------|
| 1.0.0 | 2024-11-02 | Vibe Code | Criacao inicial |

---

## 9. Aprovacoes

| Role | Nome | Assinatura | Data |
|------|------|------------|------|
| Chief Financial Officer | [CFO Name] | __________ | _____ |
| Chief Compliance Officer | [CCO Name] | __________ | _____ |
| Operations Manager | [OM Name] | __________ | _____ |

---

*Este documento e classificado como **Confidencial** e deve ser armazenado com controle de acesso adequado.*
*Qualquer copia ou distribuicao deve ser autorizada pelo CFO, CCO ou OM.*
