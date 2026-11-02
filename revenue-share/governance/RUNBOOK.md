# Runbook Operacional - Revenue Share Module
## Versao: 1.0.0 | Data: 2024-11-02 | Classificacao: Confidencial

---

## 1. Introducao

### 1.1 Proposito
Este Runbook Operacional fornece procedimentos detalhados para operacao, monitoramento, resolucao de problemas e recuperacao do modulo Revenue Share.

### 1.2 Escopo
Cobre todos os componentes do modulo Revenue Share:
- Servicos: Ingest, Calculation, Workflow, Liquidacao, Reconciliation, Audit Trail, Distribution Matrix
- Infraestrutura: Kubernetes (EKS), PostgreSQL, Kafka, S3, Vault, Redis
- Integracões: LOWDATAESC (gRPC), Observability (Prometheus/ELK/Jaeger)

### 1.3 Publico Alvo
- Operations Manager (OM)
- Calculation Operator (CO)
- Liquidity Operator (LO)
- Reconciliation Analyst (RA)
- Dispute Investigator (DI)
- Audit Officer (AO)

---

## 2. Visao Geral da Arquitetura

### 2.1 Componentes
- Ingest Service: Recebe eventos de receita do Kafka
- Calculation Service: Executa calculos de distribuicao
- Workflow Service: Gerencia fluxo de aprovacao
- Liquidacao Service: Integra com LOWDATAESC para liquidacao
- Reconciliation Service: Verifica consistencia evento-calculo-liquidacao
- Audit Trail Service: Mantem hash chain imutavel
- Distribution Matrix Service: Gerencia versões de matriz

### 2.2 Topologia de Kafka
| Topic | Partitions | Replicas | Retention |
|-------|------------|----------|-----------|
| revenue-events | 10 | 3 | 7d |
| calculations | 10 | 3 | 30d |
| approvals | 5 | 3 | 30d |
| settlement-instructions | 5 | 3 | 30d |
| reconciliations | 5 | 3 | 90d |
| disputes | 3 | 3 | 365d |
| audit-events | 3 | 3 | 365d*2 |

---

## 3. Procedimentos Operacionais Padrao (SOPs)

### 3.1 Ingestao de Eventos

#### SOP-ING-001: Verificar Saude da Ingestao
```bash
# Verificar lag do Kafka
kubectl -n revenue-share run kafka-lag-check --image=confluentinc/cp-kafka:7.0.0 -- \
  kafka-consumer-groups --bootstrap-server kafka:9092 --group ingest-service --describe

# Verificar logs
kubectl -n revenue-share logs -l app=ingest-service --tail=100 | grep -i error

# Health check
curl -k https://ingest-service.revenue-share.svc.cluster.local:8443/health
```

**Acoes se lag > 1000 eventos:**
1. Verificar pods: `kubectl -n revenue-share get pods -l app=ingest-service`
2. Reiniciar pod: `kubectl -n revenue-share delete pod -l app=ingest-service`
3. Escalar: `kubectl -n revenue-share scale deployment ingest-service --replicas=3`
4. Notificar OM se lag > 5000 eventos

#### SOP-ING-002: Reprocessar Eventos com Falha
```bash
# Listar eventos com falha
kubectl -n revenue-share exec -it ingest-service-0 -- \
  psql -h postgres -U revenue_user -d revenue_share -c \
  "SELECT id, event_type, error_message FROM revenue_events WHERE status = 'FAILED' LIMIT 100;"

# Reprocessar evento
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"event_id": "<EVENT_ID>", "retry_count": 1}' \
  https://ingest-service.revenue-share.svc.cluster.local:8443/api/v1/revenue-events/retry
```

#### SOP-ING-003: Corrigir Evento Manual
**Authority: CFO ou FC**
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "<EVENT_ID>",
    "corrections": {"gross_amount": "10000.00"},
    "justification": "Correcao conforme nota fiscal XYZ",
    "approved_by": "<CFO_USER_ID>"
  }' \
  https://ingest-service.revenue-share.svc.cluster.local:8443/api/v1/revenue-events/correct
```

---

### 3.2 Calculo de Distribuicao

#### SOP-CALC-001: Executar Calculo Manual
```bash
# Executar calculo para periodo
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{
    "period": "2024-11-01/2024-11-02",
    "matrix_version": "1.0.0",
    "idempotency_key": "calc-20241102-001"
  }' \
  https://calculation-service.revenue-share.svc.cluster.local:8443/api/v1/calculations

# Verificar status
curl -H "Authorization: Bearer $TOKEN" \
  https://calculation-service.revenue-share.svc.cluster.local:8443/api/v1/calculations/<CALCULATION_ID>
```

#### SOP-CALC-002: Validar Resultado de Calculo
```bash
# Obter detalhes
curl -H "Authorization: Bearer $TOKEN" \
  https://calculation-service.revenue-share.svc.cluster.local:8443/api/v1/calculations/<ID>/details

# Validar com dry-run
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"calculation_id": "<ID>", "dry_run": true}' \
  https://calculation-service.revenue-share.svc.cluster.local:8443/api/v1/calculations/validate
```

**Checklist de Validacao:**
- [ ] Receita bruta total correta
- [ ] Deducoes aplicadas corretamente
- [ ] Receita liquida calculada corretamente
- [ ] Reservas subtraidas corretamente
- [ ] Percentuais da matriz aplicados
- [ ] Pisos e tetos respeitados
- [ ] Hash do calculo valido

#### SOP-CALC-003: Ajustar Calculo
**Authority: BA ou FA**
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{
    "calculation_id": "<ID>",
    "adjustments": [{"participant_id": "<ID>", "field": "distribution_amount", "old_value": "1000.00", "new_value": "1050.00", "reason": "Correcao de elegibilidade"}],
    "justification": "Ajuste conforme validacao manual",
    "approved_by": "<BA_USER_ID>"
  }' \
  https://calculation-service.revenue-share.svc.cluster.local:8443/api/v1/calculations/adjust
```

---

### 3.3 Workflow de Aprovacao

#### SOP-WF-001: Aprovar Calculo (Multi-Level)
**Ordem: TA -> BA -> FA -> CA -> CFO**
```bash
# Aprovacao Tecnica (TA)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"calculation_id": "<ID>", "approval_type": "technical", "comments": "Idempotencia e hash chain verificados", "approved": true}' \
  https://workflow-service.revenue-share.svc.cluster.local:8443/api/v1/approvals

# Aprovacao de Negocio (BA)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"calculation_id": "<ID>", "approval_type": "business", "comments": "Matriz e elegibilidade validadas", "approved": true}' \
  https://workflow-service.revenue-share.svc.cluster.local:8443/api/v1/approvals

# Aprovacao Financeira (FA)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"calculation_id": "<ID>", "approval_type": "financial", "comments": "Valores e reservas conferidos", "approved": true}' \
  https://workflow-service.revenue-share.svc.cluster.local:8443/api/v1/approvals

# Aprovacao de Conformidade (CA)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"calculation_id": "<ID>", "approval_type": "compliance", "comments": "Conformidade regulatoria verificada", "approved": true}' \
  https://workflow-service.revenue-share.svc.cluster.local:8443/api/v1/approvals

# Aprovacao Final (CFO)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"calculation_id": "<ID>", "approval_type": "final", "comments": "Aprovado para liquidacao", "approved": true}' \
  https://workflow-service.revenue-share.svc.cluster.local:8443/api/v1/approvals
```

**Regras:**
- Todas as aprovacoes sao obrigatorias (AND logic)
- Qualquer rejeicao devolve para CO
- Timeout: 24h por nivel (escalonamento automatico)

#### SOP-WF-002: Rejeitar Calculo
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"calculation_id": "<ID>", "approval_type": "financial", "comments": "Reservas nao conferem", "approved": false, "rejection_reason": "INCONSISTENT_RESERVES"}' \
  https://workflow-service.revenue-share.svc.cluster.local:8443/api/v1/approvals
```

---

### 3.4 Liquidacao

#### SOP-LIQ-001: Gerar Settlement Instruction
```bash
# Listar calculos aprovados
curl -H "Authorization: Bearer $TOKEN" \
  "https://liquidacao-service.revenue-share.svc.cluster.local:8443/api/v1/settlements?status=PENDING"

# Gerar Settlement Instruction
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"calculation_id": "<ID>", "idempotency_key": "settle-<ID>-001"}' \
  https://liquidacao-service.revenue-share.svc.cluster.local:8443/api/v1/settlements
```

#### SOP-LIQ-002: Executar Liquidacao (LOWDATAESC)
```bash
# Verificar status
curl -H "Authorization: Bearer $TOKEN" \
  https://liquidacao-service.revenue-share.svc.cluster.local:8443/api/v1/settlements/<ID>/status

# Verificar callback do LOWDATAESC
kubectl -n revenue-share logs -l app=liquidacao-service --tail=50 | grep "LOWDATAESC callback"
```

**Integracao LOWDATAESC (gRPC):**
```protobuf
service Settlement {
  rpc Process (SettlementRequest) returns (SettlementResponse);
}

message SettlementRequest {
  string settlement_id = 1;
  repeated ParticipantDistribution distributions = 2;
  string idempotency_key = 3;
}

message SettlementResponse {
  string settlement_id = 1;
  string status = 2; // PENDING, COMPLETED, FAILED
  string transaction_id = 3;
  string error_message = 4;
}
```

#### SOP-LIQ-003: Tratar Falha de Liquidacao
```bash
# Obter detalhes da falha
curl -H "Authorization: Bearer $TOKEN" \
  https://liquidacao-service.revenue-share.svc.cluster.local:8443/api/v1/settlements/<ID>/errors

# Reprocessar
curl -X POST -H "Authorization: Bearer $TOKEN" \
  https://liquidacao-service.revenue-share.svc.cluster.local:8443/api/v1/settlements/<ID>/retry
```

**Causas comuns:**
- INSUFFICIENT_BALANCE: Notificar FC
- INVALID_ACCOUNT: Verificar cadastro
- DUPLICATE_TRANSACTION: Verificar idempotency_key
- NETWORK_ERROR: Retry automatico (max 3)
- TIMEOUT: Aumentar timeout

#### SOP-LIQ-004: Cancelar Liquidacao
**Authority: CFO ou FC**
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"settlement_id": "<ID>", "cancellation_reason": "ERRO_DE_VALOR", "comments": "Cancelamento solicitado pelo CFO", "approved_by": "<CFO_USER_ID>"}' \
  https://liquidacao-service.revenue-share.svc.cluster.local:8443/api/v1/settlements/cancel
```

---

### 3.5 Reconciliacao

#### SOP-REC-001: Executar Reconciliacao Automatica
```bash
# Executar manualmente
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"period": "2024-11-01/2024-11-02", "idempotency_key": "reconcile-20241102-001"}' \
  https://reconciliation-service.revenue-share.svc.cluster.local:8443/api/v1/reconciliations

# Verificar resultados
curl -H "Authorization: Bearer $TOKEN" \
  "https://reconciliation-service.revenue-share.svc.cluster.local:8443/api/v1/reconciliations?period=2024-11-01/2024-11-02"
```

**Algoritmo:**
1. Para cada evento: verificar processamento em calculo e liquidacao
2. Para cada calculo: verificar soma de distribuicoes
3. Para cada liquidacao: verificar callback do LOWDATAESC

#### SOP-REC-002: Investigar Divergencia
```bash
# Obter detalhes
curl -H "Authorization: Bearer $TOKEN" \
  https://reconciliation-service.revenue-share.svc.cluster.local:8443/api/v1/reconciliations/<ID>/discrepancies/<DISCREPANCY_ID>

# Classificar divergencia
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  -d '{"discrepancy_type": "CALCULATION_MISMATCH", "severity": "HIGH", "assigned_to": "<RA_USER_ID>"}' \
  https://reconciliation-service.revenue-share.svc.cluster.local:8443/api/v1/reconciliations/<ID>/discrepancies/<DISCREPANCY_ID>

# Verificar hash chain
curl -H "Authorization: Bearer $TOKEN" \
  https://audit-service.revenue-share.svc.cluster.local:8443/api/v1/audit/verify?event_id=<EVENT_ID>
```

**Tipos de Divergencia:**
- EVENT_MISSING: Reprocessar evento
- CALCULATION_MISMATCH: Recalcular
- SETTLEMENT_MISSING: Executar liquidacao
- AMOUNT_MISMATCH: Investigar
- PARTICIPANT_MISSING: Verificar elegibilidade
- RESERVE_MISMATCH: Verificar politica

#### SOP-REC-003: Ajustar Divergencia
**Authority: RA com aprovacao FC**
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{
    "discrepancy_id": "<ID>",
    "adjustment_type": "MANUAL_CORRECTION",
    "adjustment_data": {"event_id": "<ID>", "field": "gross_amount", "old_value": "1000.00", "new_value": "1050.00"},
    "justification": "Correcao conforme nota fiscal XYZ",
    "approved_by": "<FC_USER_ID>"
  }' \
  https://reconciliation-service.revenue-share.svc.cluster.local:8443/api/v1/reconciliations/adjust
```

**Regras:**
- Ajustes > R$ 1000 requerem aprovacao CFO
- Todos os ajustes sao auditados
- Hash chain e atualizada automaticamente

#### SOP-REC-004: Fechar Reconciliacao
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"reconciliation_id": "<ID>", "status": "CLOSED", "comments": "Todas as divergencias resolvidas", "closed_by": "<RA_USER_ID>"}' \
  https://reconciliation-service.revenue-share.svc.cluster.local:8443/api/v1/reconciliations/close
```

---

### 3.6 Disputas

#### SOP-DIS-001: Abrir Disputa
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{
    "dispute_type": "CALCULATION_ERROR",
    "severity": "HIGH",
    "title": "Erro de calculo no periodo 2024-11-01",
    "description": "O calculo para o evento XYZ nao aplicou corretamente a matriz",
    "related_ids": {"calculation_id": "<ID>", "event_id": "<ID>"},
    "evidence": [{"type": "HASH_CHAIN", "value": "sha256:abc123"}]
  }' \
  https://dispute-service.revenue-share.svc.cluster.local:8443/api/v1/disputes
```

**Tipos de Disputa:**
- FRAUD: Critical, SLA 2h
- CALCULATION_ERROR: High, SLA 24h
- SETTLEMENT_ERROR: High, SLA 24h
- RECONCILIATION_MISMATCH: Medium, SLA 72h
- CHARGEBACK: High, SLA 24h
- COMPLIANCE_VIOLATION: Critical, SLA 2h

#### SOP-DIS-002: Investigar Disputa
```bash
# Obter detalhes
curl -H "Authorization: Bearer $TOKEN" \
  https://dispute-service.revenue-share.svc.cluster.local:8443/api/v1/disputes/<ID>

# Coletar evidencias
curl -H "Authorization: Bearer $TOKEN" \
  https://audit-service.revenue-share.svc.cluster.local:8443/api/v1/audit/events?dispute_id=<ID>

# Verificar hash chain
curl -H "Authorization: Bearer $TOKEN" \
  https://audit-service.revenue-share.svc.cluster.local:8443/api/v1/audit/verify?calculation_id=<ID>
```

#### SOP-DIS-003: Propor Resolucao
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{
    "dispute_id": "<ID>",
    "resolution_type": "CALCULATION_RECALCULATION",
    "resolution_data": {"calculation_id": "<ID>", "action": "RECALCULATE"},
    "justification": "Erro identificado na aplicacao da matriz",
    "proposed_by": "<DI_USER_ID>"
  }' \
  https://dispute-service.revenue-share.svc.cluster.local:8443/api/v1/disputes/<ID>/resolutions

# Aprovar resolucao (CFO)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"resolution_id": "<ID>", "approved": true, "comments": "Aprovado", "approved_by": "<CFO_USER_ID>"}' \
  https://dispute-service.revenue-share.svc.cluster.local:8443/api/v1/disputes/resolutions/<ID>/approve
```

**Tipos de Resolucao:**
- CALCULATION_RECALCULATION: Recalcular
- SETTLEMENT_RETRY: Retentar liquidacao
- MANUAL_ADJUSTMENT: Ajuste manual
- DISMISS: Descartar
- ESCALATE: Escalar para CCO

#### SOP-DIS-004: Executar Resolucao
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  https://dispute-service.revenue-share.svc.cluster.local:8443/api/v1/disputes/resolutions/<ID>/execute

# Fechar disputa
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"dispute_id": "<ID>", "status": "RESOLVED", "resolution_summary": "Recalculo executado", "closed_by": "<DI_USER_ID>"}' \
  https://dispute-service.revenue-share.svc.cluster.local:8443/api/v1/disputes/close
```

---

### 3.7 Gestao de Matriz de Distribuicao

#### SOP-MAT-001: Propor Nova Versao
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{
    "version": "1.1.0",
    "description": "Ajuste de percentuais para Pre-Seed",
    "changes": [{"type": "PARTICIPANT_PERCENTAGE", "participant_id": "pre-seed-001", "old_value": "0.67", "new_value": "0.65"}],
    "effective_date": "2024-12-01",
    "dsl_eligibility": "participant.status == \"ACTIVE\" && participant.kyc_approved == true",
    "proposed_by": "<BA_USER_ID>"
  }' \
  https://matrix-service.revenue-share.svc.cluster.local:8443/api/v1/matrix/versions/draft
```

#### SOP-MAT-002: Testar Nova Versao (Dry-Run)
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"version": "1.1.0", "dry_run_period": "2024-10-01/2024-10-31", "idempotency_key": "dryrun-1.1.0-20241102"}' \
  https://matrix-service.revenue-share.svc.cluster.local:8443/api/v1/matrix/versions/dry-run

# Comparar resultados
curl -H "Authorization: Bearer $TOKEN" \
  https://matrix-service.revenue-share.svc.cluster.local:8443/api/v1/matrix/versions/compare?version1=1.0.0&version2=1.1.0
```

#### SOP-MAT-003: Aprovar Nova Versao
**Authority: BA + FA + CA + CFO**
```bash
# Aprovacao Tecnica (TA)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"version": "1.1.0", "approval_type": "technical", "comments": "DSL validada", "approved": true}' \
  https://matrix-service.revenue-share.svc.cluster.local:8443/api/v1/matrix/versions/approve

# Aprovacao de Negocio (BA)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"version": "1.1.0", "approval_type": "business", "comments": "Percentuais alinhados", "approved": true}' \
  https://matrix-service.revenue-share.svc.cluster.local:8443/api/v1/matrix/versions/approve

# Aprovacao Financeira (FA)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"version": "1.1.0", "approval_type": "financial", "comments": "Impacto financeiro aceitavel", "approved": true}' \
  https://matrix-service.revenue-share.svc.cluster.local:8443/api/v1/matrix/versions/approve

# Aprovacao de Conformidade (CA)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"version": "1.1.0", "approval_type": "compliance", "comments": "Conformidade verificada", "approved": true}' \
  https://matrix-service.revenue-share.svc.cluster.local:8443/api/v1/matrix/versions/approve

# Aprovacao Final (CFO)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"version": "1.1.0", "approval_type": "final", "comments": "Aprovado para deploy", "approved": true}' \
  https://matrix-service.revenue-share.svc.cluster.local:8443/api/v1/matrix/versions/approve
```

#### SOP-MAT-004: Deploy Nova Versao
**Authority: ADM**
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"version": "1.1.0", "deployed_by": "<ADM_USER_ID>", "comments": "Deploy em producao"}' \
  https://matrix-service.revenue-share.svc.cluster.local:8443/api/v1/matrix/versions/deploy

# Verificar deploy
curl -H "Authorization: Bearer $TOKEN" \
  https://matrix-service.revenue-share.svc.cluster.local:8443/api/v1/matrix/versions/active
```

#### SOP-MAT-005: Rollback de Versao
**Authority: ADM ou CFO**
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"version": "1.1.0", "rollback_to": "1.0.0", "reason": "Falha critica", "approved_by": "<CFO_USER_ID>"}' \
  https://matrix-service.revenue-share.svc.cluster.local:8443/api/v1/matrix/versions/rollback
```

---

## 4. Procedimentos de Emergencia

### 4.1 Failover para Regiao Secundaria
**Trigger: Falha completa na regiao primaria (sa-east-1)**
```bash
# Verificar status da regiao primaria
aws ec2 describe-regions --region sa-east-1 --query "Regions[?RegionName=='sa-east-1'].State"

# Ativar failover (Terraform)
cd /path/to/terraform
terraform workspace select revenue-share-failover
terraform apply -auto-approve -var="primary_region_down=true"

# Verificar servicos na regiao secundaria
kubectl --context=us-east-1 get pods -n revenue-share

# Atualizar DNS
aws route53 change-resource-record-sets --hosted-zone-id ZONE_ID --change-batch file://failover-dns.json
```

**RTO: < 15 minutos | RPO: < 5 minutos**

### 4.2 Restore de Backup
**Trigger: Perda de dados ou corrupcao**
```bash
# Identificar backup mais recente
aws s3 ls s3://revenue-share-backups/postgres/ --recursive | sort | tail -1

# Restaurar backup
kubectl -n revenue-share exec -it postgres-0 -- \
  pg_restore -U postgres -d revenue_share -C \
  /backups/revenue-share-2024-11-02T00-00-00.sql

# Verificar integridade
kubectl -n revenue-share exec -it postgres-0 -- \
  psql -U revenue_user -d revenue_share -c "SELECT COUNT(*) FROM revenue_events;"

# Sincronizar com hash chain
curl -X POST -H "Authorization: Bearer $TOKEN" \
  https://audit-service.revenue-share.svc.cluster.local:8443/api/v1/audit/sync
```

**Teste de Restore:**
- Frequencia: Mensal
- Responsavel: OM

### 4.3 Modo de Degradacao
**Trigger: Falha parcial que afeta performance**
```bash
# Ativar modo de degradacao
kubectl -n revenue-share patch configmap revenue-share-config -p '{"data":{"DEGRADED_MODE":"true","DISABLE_DASHBOARD":"true"}}'

# Escalar servicos criticos
kubectl -n revenue-share scale deployment ingest-service --replicas=5
kubectl -n revenue-share scale deployment calculation-service --replicas=5

# Aumentar timeouts
kubectl -n revenue-share patch configmap revenue-share-config -p '{"data":{"KAFKA_TIMEOUT_MS":"30000","GRPC_TIMEOUT_MS":"60000"}}'
```

---

### 4.4 Seguranca

#### SOP-SEC-001: Rotacao de Chaves de Emergencia
**Trigger: Suspeita de comprometimento de chaves**
```bash
# Revogar chaves comprometidas (Vault)
vault kv delete secret/revenue-share/keys/liquidacao-service

# Gerar novas chaves
vault kv put secret/revenue-share/keys/liquidacao-service \
  private_key="$(openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096)" \
  public_key="$(openssl rsa -pubout -in <(openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096))"

# Atualizar configuracoes
kubectl -n revenue-share create secret generic liquidacao-keys \
  --from-file=private_key=liquidacao-private.pem \
  --from-file=public_key=liquidacao-public.pem

# Reiniciar servicos
kubectl -n revenue-share rollout restart deployment liquidacao-service
```

#### SOP-SEC-002: Bloqueio de Usuario Suspeito
**Trigger: Atividade suspeita detectada**
```bash
# Bloquear usuario (OPA)
kubectl -n revenue-share exec -it opa-0 -- \
  curl -X PUT -H "Content-Type: application/json" \
  -d '{"input": {"user": {"id": "<USER_ID>"}, "action": "BLOCK"}}' \
  http://localhost:8181/v1/data/revenue_share/authz

# Revogar tokens
kubectl -n revenue-share exec -it vault-0 -- \
  vault token revoke <USER_TOKEN>
```

---

## 5. Monitoramento e Alertas

### 5.1 Metricas Criticas
| Metrica | Limiar | Acao |
|---------|--------|------|
| ingest_events_rate | < 1000 events/s | Alertar OM |
| ingest_lag | > 1000 eventos | SOP-ING-001 |
| calculation_duration | > 500ms | Alertar CO |
| approval_timeout | > 24h | Escalar para CFO |
| settlement_failure_rate | > 1% | SOP-LIQ-003 |
| reconciliation_discrepancies | > 0 | SOP-REC-002 |
| dispute_open_count | > 5 | Alertar DI |
| system_availability | < 99.95% | SOP-EMR-001 |

### 5.2 Alertas Prometheus
```yaml
groups:
- name: revenue-share-alerts
  rules:
  - alert: IngestLagHigh
    expr: kafka_consumergroup_lag{group="ingest-service"} > 1000
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Kafka lag alto para ingest-service ({{ $value }} eventos)"
  
  - alert: SettlementFailureRateHigh
    expr: rate(settlement_failures_total[5m]) / rate(settlement_total[5m]) > 0.01
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Taxa de falha de liquidacao alta ({{ $value }})"
  
  - alert: SystemAvailabilityLow
    expr: 1 - (sum(up{namespace="revenue-share"}) / count(up{namespace="revenue-share"})) > 0.0005
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Disponibilidade do sistema abaixo de 99.95%"
```

---

## 6. Manutencao Preventiva

### 6.1 Cronograma
| Atividade | Frequencia | Janela |
|-----------|------------|--------|
| Backup PostgreSQL | Diario | 01:00-02:00 UTC |
| Teste de Restore | Semanal | 03:00-04:00 UTC (Domingo) |
| Atualizacao Dependencias | Mensal | 02:00-06:00 UTC (1o Domingo) |
| Patch de Seguranca | Conforme necessario | 02:00-06:00 UTC |
| Teste de Failover | Trimestral | 02:00-06:00 UTC |

### 6.2 Procedimentos

#### SOP-MNT-001: Backup do PostgreSQL
```bash
# Executar backup
kubectl -n revenue-share exec -it postgres-0 -- \
  pg_dump -U postgres -d revenue_share -F c -f /backups/revenue-share-$(date +%Y-%m-%dT%H-%M-%S).sql

# Copiar para S3
kubectl -n revenue-share exec -it postgres-0 -- \
  aws s3 cp /backups/revenue-share-*.sql s3://revenue-share-backups/postgres/

# Verificar
aws s3 ls s3://revenue-share-backups/postgres/ | tail -1
```

**Retencao: S3 7 anos (WORM), Local 7 dias**

#### SOP-MNT-002: Teste de Restore
```bash
# Restaurar em ambiente de teste
kubectl -n revenue-share-test exec -it postgres-0 -- \
  pg_restore -U postgres -d revenue_share_test -C \
  /backups/revenue-share-2024-11-01T00-00-00.sql

# Executar testes de integridade
kubectl -n revenue-share-test exec -it postgres-0 -- \
  psql -U revenue_user -d revenue_share_test -f /tests/integrity-tests.sql

# Verificar hash chain
curl -H "Authorization: Bearer $TOKEN" \
  https://audit-service-test.revenue-share.svc.cluster.local:8443/api/v1/audit/verify-all
```

---

## 7. Relatorios Operacionais

### 7.1 Relatorio Diario
**Responsavel: OM | Frequencia: Diario 08:00 UTC**

```markdown
# Relatorio Diario - Revenue Share Module
**Data:** 2024-11-02

## Resumo Executivo
- Eventos Ingeridos: 12,456
- Calculos Executados: 45
- Liquidacoes Processadas: 42
- Divergencias de Reconciliacao: 2 (resolvidas)
- Disputas Abertas: 1 (em investigacao)
- Disponibilidade: 99.98%

## Incidentes
| ID | Tipo | Severidade | Status | Duracao |
|----|------|------------|--------|---------|
| INC-20241102-001 | Kafka Lag | Warning | Resolvido | 15m |

## Acoes Pendentes
- [ ] Investigar disputa DIS-20241102-001
- [ ] Aprovar matriz 1.1.0
```

### 7.2 Relatorio Semanal
**Responsavel: OM | Frequencia: Semanal (Segunda 09:00 UTC)**

```markdown
# Relatorio Semanal - Revenue Share Module
**Periodo:** 2024-10-28 a 2024-11-03

## KPIs Semanais
- Eventos Ingeridos: 87,345
- Calculos Executados: 315
- Liquidacoes Processadas: 298
- Taxa de Sucesso: 99.7%
- Disponibilidade Media: 99.97%

## Incidentes
| ID | Tipo | Duracao | Causa Raiz | Acao Corretiva |
|----|------|---------|------------|----------------|
| INC-20241101-001 | PostgreSQL Slow Query | 30m | Query sem indice | Adicionado indice |

## Mudancas Implementadas
- [x] Deploy versao 1.0.1 do Calculation Service
- [x] Atualizacao dependencias do Ingest Service
```

### 7.3 Relatorio Mensal
**Responsavel: OM | Frequencia: Mensal (1o dia util 10:00 UTC)**

```markdown
# Relatorio Mensal - Revenue Share Module
**Mes:** Novembro 2024

## KPIs Mensais
- Eventos Ingeridos: 262,034
- Calculos Executados: 945
- Liquidacoes Processadas: 892
- Taxa de Sucesso: 99.6%
- Disponibilidade Media: 99.96%

## SLAs
| SLA | Meta | Realizado | Status |
|-----|------|-----------|--------|
| Disponibilidade | > 99.95% | 99.96% | OK |
| RTO | < 15m | 12m | OK |
| RPO | < 5m | 3m | OK |

## Auditoria
- [x] Teste de restore de backup (sucesso)
- [x] Teste de failover (sucesso)
- [x] Revisao de seguranca (sem achados criticos)
```

---

## 8. Contatos de Emergencia

| Role | Nome | Email | Phone | Slack | PagerDuty |
|------|------|-------|-------|-------|-----------|
| CFO | [CFO Name] | cfo@company.com | +55 11 99999-9999 | @cfo | [Link] |
| CCO | [CCO Name] | cco@company.com | +55 11 99999-9998 | @cco | [Link] |
| OM | [OM Name] | om@company.com | +55 11 99999-9997 | @om | [Link] |

**Escalonamento:**
1. On-call Engineer (24/7)
2. Operations Manager (24/7)
3. CFO/CCO (incidentes criticos)

---

## 9. Controle de Versao

| Versao | Data | Autor | Mudancas |
|--------|------|-------|----------|
| 1.0.0 | 2024-11-02 | Vibe Code | Criacao inicial |

---

*Classificacao: Confidencial*
