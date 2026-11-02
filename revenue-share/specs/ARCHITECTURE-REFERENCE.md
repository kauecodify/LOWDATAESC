# Arquitetura de Referncia - Mulo Revenue Share

**Verso:** 1.0.0  
**Data:** 2024-11-02  
**Responsvel:** Arquitetura LOWDATAESC  
**Status:** Aprovado  

---

## 1. Introduo

### 1.1 Propsito
Este documento define a arquitetura de referncia do mulo Revenue Share, alinhada com a arquitetura existente do LOWDATAESC e projetada para processamento em escala internacional com alta disponibilidade, segurana e conformidade regulatria.

### 1.2 Escopo
A arquitetura abrange:
- Diagrama de componentes e dependncias
- Protocolos de comunicao
- Padres de integrao
- Escalabilidade e resilincia
- Segurana e observabilidade

---

## 2. Diagrama de Arquitetura

```mermaid
graph TD
    %% Fontes de Dados
    API[API REST\nPorta 443] -->|HTTPS/mTLS| IG[Ingest Service]
    Kafka[Kafka\nPorta 9093] -->|SASL/SSL| IG
    Batch[Batch Upload\nSFTP] -->|SSH| IG
    
    %% Servios de Ingesto
    IG -->|Valida/Normaliza| EV[Event Validator]
    EV -->|Evento Vlido| ES[Event Storage]
    EV -->|Evento Invlido| DLQ[Dead Letter Queue]
    
    %% Armazenamento
    ES -->|Escreve| S3(S3 WORM\n7 anos)
    ES -->|Indexa| PG[(PostgreSQL\nPrimary)]
    PG -->|Replica| PGR[(PostgreSQL\nReplica)]
    
    %% Processamento
    ES -->|Publica| KafkaCS[Kafka\nCalculations]
    KafkaCS -->|Consume| CS[Calculation Service]
    CS -->|Usa Matriz| DM[Distribution Matrix\nService]
    CS -->|Gera Clculo| PG
    
    %% Workflow de Aprovao
    CS -->|Cria Calculation| WS[Workflow Service]
    WS -->|Aprovao Tcnica| TA[Technical Approver]
    WS -->|Aprovao Comercial| BA[Business Approver]
    WS -->|Aprovao Financeira| FA[Financial Approver]
    WS -->|Aprovao Compliance| CA[Compliance Approver]
    
    %% Liquidao
    WS -->|Aprovado| LS[Liquidao Service]
    LS -->|gRPC/mTLS| LOWDATAESC[LOWDATAESC\nSettlement Adapter]
    LOWDATAESC -->|Confirmao| LS
    LS -->|Atualiza| PG
    
    %% Reconciliao
    LS -->|Instrues| RS[Reconciliation Service]
    ES -->|Eventos| RS
    RS -->|Relatrio| PG
    
    %% Auditoria
    IG -->|Log| AT[Audit Trail Service]
    CS -->|Log| AT
    WS -->|Log| AT
    LS -->|Log| AT
    AT -->|Escreve| S3AUDIT(S3 WORM\nAudit)
    
    %% Observabilidade
    IG -->|Mtricas| Prom[Prometheus]
    CS -->|Mtricas| Prom
    WS -->|Mtricas| Prom
    LS -->|Mtricas| Prom
    RS -->|Mtricas| Prom
    Prom -->|Armazena| Thanos[Thanos\n2 anos]
    
    IG -->|Traces| Jaeger[Jaeger\n7 dias]
    CS -->|Traces| Jaeger
    WS -->|Traces| Jaeger
    LS -->|Traces| Jaeger
    
    %% Segurana
    Vault[Vault\nKMS] -->|Chaves| IG
    Vault -->|Chaves| CS
    Vault -->|Chaves| LS
    Vault -->|Chaves| AT
    
    %% Balanceamento
    LB[Load Balancer\nAWS ALB] -->|HTTPS| IG
    LB -->|HTTPS| CS
    LB -->|HTTPS| WS
    LB -->|HTTPS| LS
    
    %% WAF
    WAF[WAF\nAWS WAF] -->|Filtra| LB
    
    %% Autenticao
    Auth[Auth Service\nOPA] -->|RBAC| IG
    Auth -->|RBAC| CS
    Auth -->|RBAC| WS
    Auth -->|RBAC| LS
    
    %% Style
    classDef source fill:#00ff00,stroke:#000
    classDef service fill:#0000ff,stroke:#000
    classDef storage fill:#ff00ff,stroke:#000
    classDef external fill:#ff0000,stroke:#000
    classDef security fill:#ffff00,stroke:#000
    
    class API,Kafka,Batch source
    class IG,EV,CS,DM,WS,LS,RS,AT,Auth service
    class S3,PG,PGR,Thanos,Jaeger storage
    class LOWDATAESC external
    class Vault,WAF,LB security
```

---

## 3. Componentes

### 3.1 Ingest Service
**Responsabilidade:** Receber, validar e normalizar eventos de receita.

**Funcionalidades:**
- Receber eventos via API REST, Kafka ou Batch
- Validar schema e assinatura digital
- Verificar idempotncia
- Normalizar para schema cannico
- Armazenar em S3 WORM e PostgreSQL
- Publicar em Kafka para processamento assncrono

**Tecnologias:**
- Linguagem: TypeScript (NestJS)
- Framework: NestJS
- Banco: PostgreSQL
- Mensageria: Kafka
- Armazenamento: S3

**Endpoints:**
- `POST /api/v1/revenue-events` (Ingesto)
- `GET /api/v1/revenue-events/{id}` (Consulta)
- `GET /api/v1/revenue-events` (Lista)

---

### 3.2 Event Validator
**Responsabilidade:** Validar eventos de receita.

**Funcionalidades:**
- Validar schema JSON Schema
- Verificar assinatura digital (ECDSA ou RSA)
- Verificar idempotncia (hash do payload)
- Validar campos obrigatrios
- Validar formatao (ISO 4217, ISO 3166-1, etc.)

**Tecnologias:**
- Linguagem: TypeScript
- Validao: ajv (JSON Schema validator)
- Criptografia: OpenSSL, WebCrypto

---

### 3.3 Calculation Service
**Responsabilidade:** Calcular distribuio de receita.

**Funcionalidades:**
- Agregar eventos por perodo
- Aplicar dedues (taxas, impostos, chargebacks, etc.)
- Calcular receita lquida
- Aplicar matriz de distribuio
- Calcular pisos e tetos
- Gerar calculation
- Calcular hash do clculo

**Tecnologias:**
- Linguagem: TypeScript (NestJS)
- Banco: PostgreSQL
- Cache: Redis

**Endpoints:**
- `POST /api/v1/calculations` (Criar)
- `GET /api/v1/calculations/{id}` (Consultar)
- `GET /api/v1/calculations` (Listar)

---

### 3.4 Distribution Matrix Service
**Responsabilidade:** Gerenciar matrizes de distribuio.

**Funcionalidades:**
- Criar, atualizar e versionar matrizes
- Validar matrizes (soma = 100%, etc.)
- Aprovar matrizes (workflow)
- Fornecer matriz ativa para perodo
- Avaliar DSL de elegibilidade

**Tecnologias:**
- Linguagem: TypeScript (NestJS)
- Banco: PostgreSQL

**Endpoints:**
- `GET /api/v1/distribution-matrices/{version}` (Consultar)
- `GET /api/v1/distribution-matrices` (Listar)

---

### 3.5 Workflow Service
**Responsabilidade:** Gerenciar workflow de aprovao.

**Funcionalidades:**
- Implementar mquina de estados
- Enforar segregao de funes (RBAC)
- Notificar aprovadores
- Escalar em caso de timeout
- Registrar trilha de auditoria

**Tecnologias:**
- Linguagem: TypeScript (NestJS)
- Workflow: Camunda (opcional) ou estado em banco
- Autenticao: OPA (Open Policy Agent)

**Endpoints:**
- `POST /api/v1/calculations/{id}/submit` (Submeter)
- `POST /api/v1/calculations/{id}/approve` (Aprovar)
- `POST /api/v1/calculations/{id}/reject` (Rejeitar)

---

### 3.6 Liquidao Service
**Responsabilidade:** Gerar e processar instrues de liquidao.

**Funcionalidades:**
- Gerar instrues de liquidao para cada participante
- Assinar digitalmente instrues
- Enviar para LOWDATAESC via gRPC
- Gerenciar retries com backoff exponencial
- Receber confirmaes do LOWDATAESC
- Atualizar status de clculos

**Tecnologias:**
- Linguagem: Go (para performance)
- Comunicao: gRPC
- Segurana: mTLS

**Endpoints:**
- `POST /api/v1/settlement-instructions` (Gerar)
- `GET /api/v1/settlement-instructions/{id}` (Consultar)

---

### 3.7 Reconciliation Service
**Responsabilidade:** Reconciliar eventos e liquidaes.

**Funcionalidades:**
- Agregar eventos e liquidaes por perodo
- Comparar totais
- Identificar divergncias
- Gerar relatrio de divergncias
- Notificar financeiro e compliance

**Tecnologias:**
- Linguagem: Python
- Banco: PostgreSQL
- Agendamento: Kubernetes CronJob

**Endpoints:**
- `POST /api/v1/reconciliations` (Executar)
- `GET /api/v1/reconciliations/{id}` (Consultar)

---

### 3.8 Audit Trail Service
**Responsabilidade:** Registrar trilha de auditoria imutvel.

**Funcionalidades:**
- Registrar todas as aes do sistema
- Gerar hash chain
- Armazenar em S3 WORM
- Verificar integridade
- Exportar proof bundles

**Tecnologias:**
- Linguagem: Rust (para performance e segurana)
- Armazenamento: S3 com Object Lock
- Hash: SHA-256

---

## 4. Dependncias Externas

### 4.1 LOWDATAESC
**Integrao:** gRPC com mTLS

**Servios Utilizados:**
- Settlement Adapter: Processamento de liquidaes
- Escrow Service: Gerenciamento de contas escrow
- Auth Service: Autenticao e autorizao

**Endpoints:**
- `settlement-adapter.lowdataesc.internal:50051` (gRPC)
- `escrow.lowdataesc.internal:50052` (gRPC)

---

### 4.2 Kafka
**Uso:** Mensageria para processamento assncrono

**Topics:**
- `revenue-events`: Eventos de receita (ingesto)
- `calculations`: Clculos (processamento)
- `settlement-instructions`: Instrues de liquidao
- `audit-logs`: Logs de auditoria

**Configurao:**
- Replicao: 3
- Partitions: 10 por topic
- Retention: 7 dias

---

### 4.3 PostgreSQL
**Uso:** Armazenamento de dados estruturados

**Bancos:**
- `revenue_share`: Dados do mulo
- `audit`: Trilha de auditoria (opcional, pode ser S3)

**Configurao:**
- Primary/Replica: Multi-AZ
- Backup: Contnuo (WAL archiving)
- Reteno: 7 anos

---

### 4.4 S3
**Uso:** Armazenamento imutvel

**Buckets:**
- `lowdataesc-revenue-events`: Eventos de receita (WORM)
- `lowdataesc-audit-logs`: Trilha de auditoria (WORM)
- `lowdataesc-proof-bundles`: Proof bundles (WORM)

**Configurao:**
- Object Lock: 7 anos
- Versioning: Habilitado
- Criptografia: SSE-KMS

---

### 4.5 Redis
**Uso:** Cache e sesses

**Casos de Uso:**
- Cache de matrizes de distribuio
- Cache de clculos recentes
- Rate limiting
- Sesses de usurios

**Configurao:**
- Cluster: 3 ns
- Persistncia: RDB + AOF
- TTL: Configurvel por chave

---

### 4.6 Vault
**Uso:** Gerenciamento de segredos e chaves

**Segredos Gerenciados:**
- Chaves de assinatura digital
- Certificados mTLS
- Credenciais de banco de dados
- Chaves de API externas

**Configurao:**
- Transit encryption: Habilitado
- Audit log: Habilitado
- Rotao de chaves: Automtica (90 dias)

---

## 5. Protocolos de Comunicao

### 5.1 API REST
**Protocolo:** HTTPS (TLS 1.3)
**Autenticao:** mTLS + JWT
**Autorizao:** RBAC via OPA
**Formato:** JSON
**Versionamento:** URL (v1, v2, etc.)

**Endpoints Pblicos:**
- `/api/v1/revenue-events`
- `/api/v1/calculations`
- `/api/v1/settlement-instructions`
- `/api/v1/disputes`

---

### 5.2 gRPC
**Protocolo:** gRPC com mTLS
**Formato:** Protocol Buffers
**Compresso:** gzip
**Streaming:** Suportado

**Servios:**
- `CalculationService`: Clculo de distribuio
- `SettlementService`: Liquidao
- `AuditService`: Trilha de auditoria

---

### 5.3 Kafka
**Protocolo:** SASL/SSL
**Formato:** Avro ou JSON Schema
**Compresso:** snappy
**QOS:** Exactly-once

**Topics:**
- `revenue-events`: Eventos de receita
- `calculations`: Clculos
- `settlement-instructions`: Instrues de liquidao

---

## 6. Segurana

### 6.1 Autenticao
- **mTLS:** Entre servios internos (SPIFFE/SPIRE)
- **JWT:** Para APIs externas
- **MFA:** Para usurios humanos (TOTP + Biometria)
- **Device Authentication:** Device fingerprint + certificado

### 6.2 Autorizao
- **RBAC:** Roles hierrquicos
- **ABAC:** Atributos (operao, valor, tipo)
- **OPA:** Open Policy Agent para polticas complexas
- **Segregao de Funes:** Matriz RACI

### 6.3 Criptografia
- **Em Trnsito:** TLS 1.3
- **Em Repouso:** AES-256 (KMS)
- **Chaves:** HSM ou KMS
- **Hash:** SHA-256

### 6.4 Proteo de Dados
- **LGPD:** Conformidade total
- **DLP:** Data Loss Prevention
- **Crypto-wipe:** Capacidade de apagar dados

---

## 7. Observabilidade

### 7.1 Logging
- **Ferramenta:** ELK Stack (Elasticsearch, Logstash, Kibana)
- **Formato:** JSON estruturado
- **Nveis:** DEBUG, INFO, WARN, ERROR
- **Reteno:** 7 dias (hot), 30 dias (warm), 1 ano (cold)

### 7.2 Mtricas
- **Ferramenta:** Prometheus + Thanos
- **Armazenamento:** 2 anos
- **Mtricas:**
  - Latncia (p50, p95, p99)
  - Throughput
  - Erros (rate, count)
  - Saturao (CPU, memria, disco, rede)

### 7.3 Tracing
- **Ferramenta:** OpenTelemetry + Jaeger
- **Sampling:** 100% para erros, 1% para sucesso
- **Armazenamento:** 7 dias
- **Correlao:** Trace ID propagado

### 7.4 Alertas
- **Ferramenta:** Alertmanager
- **Canais:** Slack, PagerDuty, Email
- **Nveis:** Crtico, Alto, Mdio, Baixo

---

## 8. Escalabilidade

### 8.1 Horizontal
- **Servios:** Todos os servios so stateless (exceto banco)
- **Kubernetes:** Deploy com HPA (Horizontal Pod Autoscaler)
- **Limite:** Mnimo 3 instncias por servio crtico

### 8.2 Vertical
- **Banco:** Read replicas + connection pooling
- **Cache:** Redis cluster
- **Mensageria:** Kafka com parties

### 8.3 Performance
- **Alvo:** 5000 TPS (ingesto de eventos)
- **Latncia:** < 100ms (p99)
- **Disponibilidade:** > 99.95%

---

## 9. Resilincia

### 9.1 RPO/RTO
- **RPO:** < 5 minutos
- **RTO:** < 15 minutos (servios), < 30 minutos (banco)

### 9.2 Backup e Restore
- **Banco:** WAL archiving + backup dirio
- **S3:** Versioning + cross-region replication
- **Teste:** Restore testado mensalmente

### 9.3 Multi-Region
- **Primary:** sa-east-1 (So Paulo)
- **Secondary:** us-east-1 (Virgnia) - standby
- **Failover:** Automtico com Route53

---

## 10. Implantao

### 10.1 Infraestrutura
- **Terraform:** IaC (Infrastructure as Code)
- **Kubernetes:** EKS (Elastic Kubernetes Service)
- **CI/CD:** GitHub Actions / GitLab CI
- **Imagens:** Docker imutveis

### 10.2 Ambientes
- **dev:** Desenvolvimento
- **staging:** Testes e homologao
- **production:** Produo

### 10.3 Deploy
- **Estratgia:** Blue-green ou Canary
- **Rollback:** Automtico em caso de falha
- **Sade:** Health checks + readiness probes

---

## 11. Critrios de Aceite

- [ ] Arquitetura documentada e validada
- [ ] Diagramas atualizados
- [ ] Componentes implementados conforme especificao
- [ ] Integrao com LOWDATAESC funcional
- [ ] Segurana implementada (mTLS, RBAC, etc.)
- [ ] Observabilidade completa (logging, mtricas, tracing)
- [ ] Escalabilidade validada (load tests)
- [ ] Resilincia testada (chaos engineering)

---

## 12. Anexos

- [Diagrama de Arquitetura Detalhado](ARCHITECTURE-DIAGRAM.md)
- [Especificao de APIs](OPENAPI-SPEC.md)
- [Especificao de Eventos](EVENT-SPEC.md)
- [Especificao de Integrao com LOWDATAESC](LOWDATAESC-INTEGRATION.md)

---

**Aprovado por:** _________________________  
**Data:** _______________  
**Verso:** 1.0.0
