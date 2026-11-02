# Threat Model - Mulo Revenue Share

**Verso:** 1.0.0  
**Data:** 2024-11-02  
**Responsvel:** Arquitetura LOWDATAESC  
**Status:** Aprovado  
**Metodologia:** STRIDE

---

## 1. Introduo

### 1.1 Propsito
Este documento identifica e analisa as ameaas de segurana para o mulo Revenue Share, utilizando a metodologia STRIDE para categorizar e mitigar riscos.

### 1.2 Escopo
O threat model abrange:
- Ingesto de eventos de receita
- Clculo de distribuio
- Workflow de aprovao
- Liquidao financeira
- Reconciliao
- Gerenciamento de disputas
- Auditoria

### 1.3 Metodologia STRIDE
- **S**poofing: Falsificao de identidade
- **T**ampering: Manipulao de dados
- **R**epudiation: Negativa de ao
- **I**nformation Disclosure: Divulgao de informaes
- **D**enial of Service: Negativa de servio
- **E**levation of Privilege: Elevao de privilgios

---

## 2. Diagrama de Contexto

```mermaid
graph TD
    %% Atores Externos
    Ext[Atores Externos\n(Operaes, Parceiros)] -->|HTTPS/mTLS| API[API Gateway]
    
    %% Atores Internos
    Int[Atores Internos\n(Operadores, Aprovadores)] -->|mTLS| API
    
    %% Servios
    API -->|gRPC/mTLS| LOWDATAESC[LOWDATAESC\nSettlement Adapter]
    API -->|Kafka| CS[Calculation Service]
    API -->|PostgreSQL| DB[(Banco de Dados)]
    API -->|S3| S3[Armazenamento\nS3 WORM]
    API -->|Vault| Vault[Vault\nKMS]
    
    %% Ameaas
    Ext -.-|Spoofing| Spoof1[Falsificao de\nidentidade externa]
    Int -.-|Spoofing| Spoof2[Falsificao de\nidentidade interna]
    API -.-|Tampering| Tamper1[Manipulao de\nrequisies]
    CS -.-|Tampering| Tamper2[Manipulao de\nclculos]
    DB -.-|Tampering| Tamper3[Manipulao de\ndados]
    S3 -.-|Tampering| Tamper4[Manipulao de\narquivos]
    API -.-|Repudiation| Repud1[Negativa de\nrequisio]
    CS -.-|Repudiation| Repud2[Negativa de\nclculo]
    API -.-|Information Disclosure| Info1[Vazamento de\ndados em trnsito]
    DB -.-|Information Disclosure| Info2[Vazamento de\ndados em repouso]
    S3 -.-|Information Disclosure| Info3[Vazamento de\narquivos]
    API -.-|Denial of Service| DoS1[Ataque de DoS\nna API]
    CS -.-|Denial of Service| DoS2[Ataque de DoS\nno servio]
    Int -.-|Elevation of Privilege| Elev1[Elevao de\nprivilgios]
```

---

## 3. Anlise STRIDE

### 3.1 Spoofing (Falsificao de Identidade)

| ID | Ameaa | Descrio | Ativo | Impacto | Probabilidade | Risco | Mitigao |
|----|---------|-------------|--------|---------|---------------|-------|-------------|
| S-001 | Falsificao de operador | Ator externo se passa por operador interno | API, CS | Alto | Mdia | Alto | mTLS + JWT + MFA |
| S-002 | Falsificao de operao | Operador envia eventos em nome de outra operao | API | Alto | Mdia | Alto | Assinatura digital + validao de certificado |
| S-003 | Falsificao de LOWDATAESC | Servio malicioso se passa pelo LOWDATAESC | LOWDATAESC | Crtico | Baixa | Alto | mTLS mtuo + validao de certificado |
| S-004 | Replay de eventos | Reenvio de eventos j processados | API | Alto | Mdia | Alto | Idempotncia + nonce |
| S-005 | Falsificao de aprovador | Usurio no autorizado aprova clculos | WS | Crtico | Baixa | Mdio | RBAC + segregao de funes |

---

### 3.2 Tampering (Manipulao de Dados)

| ID | Ameaa | Descrio | Ativo | Impacto | Probabilidade | Risco | Mitigao |
|----|---------|-------------|--------|---------|---------------|-------|-------------|
| T-001 | Manipulao de evento | Modificao de evento antes da ingesto | API | Crtico | Mdia | Alto | Assinatura digital + hash chain |
| T-002 | Manipulao de clculo | Modificao de valores no clculo | CS | Crtico | Baixa | Alto | Hash do clculo + trilha de auditoria |
| T-003 | Manipulao de matriz | Modificao da matriz de distribuio | DM | Crtico | Baixa | Alto | Assinatura digital + versionamento |
| T-004 | Manipulao de instruo | Modificao de instruo de liquidao | LS | Crtico | Baixa | Alto | Assinatura digital + idempotncia |
| T-005 | Manipulao de trilha de auditoria | Modificao de logs de auditoria | AT | Crtico | Baixa | Alto | S3 WORM + hash chain |
| T-006 | Manipulao de reconciliao | Modificao de resultados de reconciliao | RS | Alto | Baixa | Mdio | Assinatura digital + hash |

---

### 3.3 Repudiation (Negativa de Ao)

| ID | Ameaa | Descrio | Ativo | Impacto | Probabilidade | Risco | Mitigao |
|----|---------|-------------|--------|---------|---------------|-------|-------------|
| R-001 | Negativa de ingesto | Operador nega ter enviado evento | API | Alto | Mdia | Alto | Assinatura digital + trilha de auditoria |
| R-002 | Negativa de clculo | Operador nega ter criado clculo | CS | Alto | Mdia | Alto | Trilha de auditoria + hash |
| R-003 | Negativa de aprovao | Aprovador nega ter aprovado clculo | WS | Crtico | Baixa | Alto | Assinatura digital + trilha |
| R-004 | Negativa de liquidao | LOWDATAESC nega ter processado instruo | LS | Crtico | Baixa | Alto | Confirmao assinada + trilha |
| R-005 | Negativa de recepo | Participante nega ter recebido liquidao | LS | Alto | Mdia | Alto | Confirmao do LOWDATAESC + prova |

---

### 3.4 Information Disclosure (Divulgao de Informaes)

| ID | Ameaa | Descrio | Ativo | Impacto | Probabilidade | Risco | Mitigao |
|----|---------|-------------|--------|---------|---------------|-------|-------------|
| I-001 | Vazamento de eventos | Exposio de eventos de receita | API, DB | Crtico | Mdia | Alto | Criptografia em trnsito + repouso |
| I-002 | Vazamento de matriz | Exposio de matriz de distribuio | DM | Alto | Baixa | Mdio | RBAC + criptografia |
| I-003 | Vazamento de instrues | Exposio de instrues de liquidao | LS | Crtico | Baixa | Alto | RBAC + criptografia + DLP |
| I-004 | Vazamento de dados pessoais | Exposio de dados de participantes | DB | Crtico | Baixa | Alto | LGPD compliance + anonimizao |
| I-005 | Vazamento de chaves | Exposio de chaves de assinatura | Vault | Crtico | Baixa | Alto | HSM + RBAC estrito |
| I-006 | Logs sensveis | Exposio de informaes em logs | API, CS | Alto | Mdia | Alto | Filtro de logs + DLP |

---

### 3.5 Denial of Service (Negativa de Servio)

| ID | Ameaa | Descrio | Ativo | Impacto | Probabilidade | Risco | Mitigao |
|----|---------|-------------|--------|---------|---------------|-------|-------------|
| D-001 | DoS na API | Ataque de negao de servio na API | API | Alto | Alta | Alto | WAF + rate limiting + auto-scaling |
| D-002 | DoS no Kafka | Saturao do Kafka com eventos | Kafka | Alto | Mdia | Alto | Rate limiting + autenticao |
| D-003 | DoS no banco | Saturao do banco com consultas | DB | Crtico | Baixa | Mdio | Connection pooling + query optimization |
| D-004 | DoS no servio de clculo | Saturao do servio de clculo | CS | Alto | Baixa | Mdio | Auto-scaling + circuit breaker |
| D-005 | DoS na liquidao | Saturao do servio de liquidao | LS | Crtico | Baixa | Mdio | Rate limiting + retry com backoff |

---

### 3.6 Elevation of Privilege (Elevao de Privilgios)

| ID | Ameaa | Descrio | Ativo | Impacto | Probabilidade | Risco | Mitigao |
|----|---------|-------------|--------|---------|---------------|-------|-------------|
| E-001 | Elevao de operador | Operador obtm acesso de aprovador | API, WS | Crtico | Baixa | Alto | RBAC + segregao de funes |
| E-002 | Elevao de aprovador | Aprovador obtm acesso de compliance | WS | Crtico | Baixa | Alto | RBAC + segregao de funes |
| E-003 | Elevao de servio | Servio obtm acesso no autorizado | API | Crtico | Baixa | Alto | mTLS + service mesh |
| E-004 | Bypass de autenticao | Contornar autenticao | API | Crtico | Baixa | Alto | mTLS + JWT + OPA |
| E-005 | Bypass de RBAC | Contornar controles de acesso | API, WS | Crtico | Baixa | Alto | OPA + audit de permisses |

---

## 4. Anlise de Risco

### 4.1 Matriz de Risco

| Risco | Probabilidade | Impacto | Nvel | Prioridade |
|-------|---------------|---------|----------|------------|
| Alto | Alta | Crtico | Crtico | 1 |
| Alto | Alta | Alto | Alto | 2 |
| Alto | Mdia | Crtico | Alto | 2 |
| Alto | Mdia | Alto | Alto | 2 |
| Alto | Baixa | Crtico | Alto | 2 |
| Mdio | Alta | Alto | Alto | 2 |
| Mdio | Alta | Crtico | Alto | 2 |
| Mdio | Mdia | Crtico | Mdio | 3 |
| Mdio | Mdia | Alto | Mdio | 3 |
| Mdio | Baixa | Crtico | Mdio | 3 |
| Baixo | Alta | Alto | Mdio | 3 |
| Baixo | * | Crtico | Mdio | 3 |
| * | * | Baixo | Baixo | 4 |

### 4.2 Riscos Crticos (Prioridade 1)

| ID | Ameaa | Descrio | Mitigao |
|----|---------|-------------|-------------|
| S-003 | Falsificao de LOWDATAESC | Servio malicioso se passa pelo LOWDATAESC | mTLS mtuo + validao de certificado |
| T-001 | Manipulao de evento | Modificao de evento antes da ingesto | Assinatura digital + hash chain |
| T-002 | Manipulao de clculo | Modificao de valores no clculo | Hash do clculo + trilha de auditoria |
| T-003 | Manipulao de matriz | Modificao da matriz de distribuio | Assinatura digital + versionamento |
| T-004 | Manipulao de instruo | Modificao de instruo de liquidao | Assinatura digital + idempotncia |
| T-005 | Manipulao de trilha de auditoria | Modificao de logs de auditoria | S3 WORM + hash chain |
| R-003 | Negativa de aprovao | Aprovador nega ter aprovado clculo | Assinatura digital + trilha |
| R-004 | Negativa de liquidao | LOWDATAESC nega ter processado instruo | Confirmao assinada + trilha |
| I-001 | Vazamento de eventos | Exposio de eventos de receita | Criptografia em trnsito + repouso |
| I-003 | Vazamento de instrues | Exposio de instrues de liquidao | RBAC + criptografia + DLP |
| I-004 | Vazamento de dados pessoais | Exposio de dados de participantes | LGPD compliance + anonimizao |
| I-005 | Vazamento de chaves | Exposio de chaves de assinatura | HSM + RBAC estrito |
| D-001 | DoS na API | Ataque de negao de servio na API | WAF + rate limiting + auto-scaling |
| E-001 | Elevao de operador | Operador obtm acesso de aprovador | RBAC + segregao de funes |
| E-002 | Elevao de aprovador | Aprovador obtm acesso de compliance | RBAC + segregao de funes |

---

## 5. Controles de Segurana

### 5.1 Autenticao
- **mTLS:** Todos os servios internos usam mTLS com SPIFFE/SPIRE
- **JWT:** APIs externas usam JWT com OPA para autorizao
- **MFA:** Usurios humanos usam MFA (TOTP + Biometria)
- **Device Authentication:** Device fingerprint + certificado

### 5.2 Autorizao
- **RBAC:** Roles hierrquicos com segregao de funes
- **ABAC:** Atributos (operao, valor, tipo, jurisdio)
- **OPA:** Open Policy Agent para polticas complexas
- **Segregao de Funes:** Matriz RACI implementada

### 5.3 Criptografia
- **Em Trnsito:** TLS 1.3 para todas as comunicaes
- **Em Repouso:** AES-256 (KMS) para dados sensveis
- **Chaves:** HSM ou KMS com rotao automtica
- **Hash:** SHA-256 para integridade

### 5.4 Proteo de Dados
- **LGPD:** Conformidade total com anonimizao e consentimento
- **DLP:** Data Loss Prevention para dados sensveis
- **Crypto-wipe:** Capacidade de apagar dados de forma segura

### 5.5 Auditoria
- **Trilha de Auditoria:** Imutvel (S3 WORM + hash chain)
- **Logging:** JSON estruturado com todos os eventos
- **Monitoramento:** SIEM para deteco de anomalias

### 5.6 Resilincia
- **Backup:** WAL archiving + backup dirio
- **Restore:** Testado mensalmente
- **Multi-Region:** Primary/Secondary com failover automtico

---

## 6. Recomendaes

### 6.1 Prioridade 1 (Implementar Imediatamente)
- [ ] mTLS entre todos os servios internos
- [ ] Assinatura digital para eventos, clculos, matrizes e instrues
- [ ] Hash chain para trilha de auditoria
- [ ] RBAC com segregao de funes
- [ ] Criptografia em repouso para dados sensveis
- [ ] WAF + rate limiting na API

### 6.2 Prioridade 2 (Implementar antes do Go-Live)
- [ ] HSM para chaves de assinatura
- [ ] DLP para prevenir vazamento de dados
- [ ] SIEM para monitoramento de segurana
- [ ] Pentest completo
- [ ] Treinamento de segurana para operadores

### 6.3 Prioridade 3 (Implementar ps Go-Live)
- [ ] Zero Trust Architecture
- [ ] Service Mesh (Istio ou Linkerd)
- [ ] Threat Intelligence Integration
- [ ] Bug Bounty Program

---

## 7. Validao

### 7.1 Pentest
- **Frequncia:** Trimestral
- **Escopo:** Todos os servios e APIs
- **Metodologia:** OWASP Testing Guide
- **Relatrio:** Com evidncias e plano de ao

### 7.2 Threat Model Review
- **Frequncia:** A cada mudana significativa ou trimestral
- **Participantes:** Segurana, Arquitetura, Desenvolvimento
- **Foco:** Novas ameaas e mitigaes

### 7.3 Audit de Segurana
- **Frequncia:** Anual
- **Escopo:** Todos os controles de segurana
- **Certificao:** ISO 27001 (alvo)

---

## 8. Critrios de Aceite

- [ ] Todos os riscos crticos mitigados
- [ ] Controles de segurana implementados conforme especificado
- [ ] Pentest executado e vulnerabilidades corrigidas
- [ ] Threat model revisado e aprovado
- [ ] Treinamento de segurana concludo
- [ ] Documentao de segurana completa

---

## 9. Anexos

- [Matriz RACI](../governance/RACI-MATRIX.md)
- [Poltica de Segurana](../security/SECURITY-POLICY.md)
- [Plano de Resposta a Incidentes](../operations/INCIDENT-RESPONSE-PLAN.md)
- [Relatrio de Pentest](../security/PENTEST-REPORT.md)

---

**Aprovado por:** _________________________  
**Data:** _______________  
**Verso:** 1.0.0
