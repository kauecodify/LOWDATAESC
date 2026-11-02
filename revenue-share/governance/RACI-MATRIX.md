# Matriz RACI - Revenue Share Module
## Versão: 1.0.0 | Data: 2024-11-02 | Classificação: Confidencial

---

## 1. Introdução

### 1.1 Propósito
Este documento define a **Matriz RACI** (Responsible, Accountable, Consulted, Informed) para o módulo Revenue Share, estabelecendo claramente as responsabilidades, autoridades e fluxos de comunicação entre os diversos atores envolvidos no processamento de distribuição de receita.

### 1.2 Escopo
A matriz abrange todas as atividades críticas do módulo Revenue Share, desde a ingestão de eventos até a reconciliação e resolução de disputas, garantindo:
- **Segregação de funções** (SoD - Segregation of Duties)
- **Conformidade com TR8** (padrão de governança interno)
- **Alinhamento com RBAC** (Role-Based Access Control definido em `RBAC-POLICY.md`)
- **Rastreabilidade** de decisões e ações

### 1.3 Referências
- [RBAC-POLICY.md](../security/RBAC-POLICY.md) - Políticas de RBAC e definição de roles
- [STATE-MACHINE.md](../docs/STATE-MACHINE.md) - Máquina de estados do módulo
- [ARCHITECTURE-REFERENCE.md](../specs/ARCHITECTURE-REFERENCE.md) - Arquitetura técnica
- [DRF-REVENUE-SHARE.md](../docs/DRF-REVENUE-SHARE.md) - Requisitos funcionais

---

## 2. Definições RACI

| Sigla | Definição | Responsabilidade |
|-------|-----------|-----------------|
| **R** (Responsible) | **Responsável** | Executa a atividade. Pode ser múltiplo. |
| **A** (Accountable) | **Prestador de Contas** | Garante que a atividade é executada corretamente. **Apenas um por atividade.** |
| **C** (Consulted) | **Consultado** | Fornece input/feedback. Comunicação bidirecional. |
| **I** (Informed) | **Informado** | Recebe atualizações. Comunicação unidirecional. |

---

## 3. Roles e Responsabilidades

### 3.1 Hierarquia de Authority

```
┌─────────────────────────────────────────────────────────────────┐
│                    NÍVEL ESTRATÉGICO (L1)                       │
├─────────────────────────────────────────────────────────────────┤
│  • Super Admin (SA)                                             │
│  • Chief Financial Officer (CFO)                                │
│  • Chief Compliance Officer (CCO)                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NÍVEL TÁTICO (L2)                            │
├─────────────────────────────────────────────────────────────────┤
│  • Admin (ADM)                                                  │
│  • Compliance Officer (COMP)                                    │
│  • Financial Controller (FC)                                    │
│  • Operations Manager (OM)                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NÍVEL OPERACIONAL (L3)                       │
├─────────────────────────────────────────────────────────────────┤
│  • Calculation Operator (CO)                                     │
│  • Technical Approver (TA)                                      │
│  • Business Approver (BA)                                       │
│  • Financial Approver (FA)                                      │
│  • Compliance Approver (CA)                                     │
│  • Liquidity Operator (LO)                                       │
│  • Dispute Investigator (DI)                                    │
│  • Reconciliation Analyst (RA)                                  │
│  • Audit Officer (AO)                                           │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Descrição de Roles

| Role | ID | Descrição | Nível | Acesso | Segregação de Funções |
|------|-----|-----------|-------|--------|----------------------|
| Super Admin | SA | Acesso total ao sistema, configuração de matrizes, gestão de users | L1 | Full | Não pode executar operações financeiras |
| Chief Financial Officer | CFO | Responsável pela estratégia financeira e aprovação final | L1 | Read + Approve | Não pode calcular ou liquidar |
| Chief Compliance Officer | CCO | Garante conformidade regulatória | L1 | Read + Audit | Não pode aprovar transações |
| Admin | ADM | Gestão de configurações e monitoramento | L2 | Admin | Não pode aprovar ou liquidar |
| Compliance Officer | COMP | Monitora conformidade LGPD, BCB, CVM | L2 | Read + Audit | Não pode executar transações |
| Financial Controller | FC | Controladoria, reconciliação, reservas | L2 | Read + Write | Não pode aprovar suas próprias cálculos |
| Operations Manager | OM | Gestão operacional, SLA, incidentes | L2 | Read + Execute | Não pode aprovar transações |
| Calculation Operator | CO | Executa cálculos de distribuição | L3 | Write | Não pode aprovar seus cálculos |
| Technical Approver | TA | Aprova aspectos técnicos (idempotência, hash chain) | L3 | Approve | Não pode calcular |
| Business Approver | BA | Aprova lógica de negócio (matriz, elegibilidade) | L3 | Approve | Não pode calcular |
| Financial Approver | FA | Aprova valores financeiros | L3 | Approve | Não pode calcular ou liquidar |
| Compliance Approver | CA | Aprova conformidade regulatória | L3 | Approve | Não pode executar transações |
| Liquidity Operator | LO | Executa liquidações (chamadas LOWDATAESC) | L3 | Execute | Não pode aprovar liquidações |
| Dispute Investigator | DI | Investiga disputas e divergências | L3 | Read + Investigate | Não pode aprovar resoluções |
| Reconciliation Analyst | RA | Analisa e resolve divergências de reconciliação | L3 | Read + Reconcile | Não pode aprovar ajustes |
| Audit Officer | AO | Auditoria contínua, verificação de hash chain | L3 | Read + Audit | Não pode modificar dados |

---

## 4. Matriz RACI por Atividade

### 4.1 Ingestão de Eventos (Revenue Event Ingestion)

| Atividade | SA | CFO | CCO | ADM | COMP | FC | OM | CO | TA | BA | FA | CA | LO | DI | RA | AO |
|-----------|----|-----|-----|-----|------|----|----|----|----|----|----|----|----|----|----|----|
| Configurar fonte de eventos (Kafka topic) | A | I | I | R | C | I | I | - | - | - | - | - | - | - | - | I |
| Validar schema de evento | - | - | - | R | C | I | I | - | A | - | - | - | - | - | - | I |
| Ingerir evento de receita | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | I |
| **Reprocessar evento (retry)** | - | - | - | R | - | I | I | - | C | - | - | - | - | - | - | I |
| **Corrigir evento (manual override)** | - | A | C | R | C | I | I | - | - | - | - | C | - | - | - | I |
| Monitorar taxa de ingestão | - | I | - | R | - | - | A | - | - | - | - | - | - | - | - | I |
| Alertar falha de ingestão | - | I | - | R | - | - | A | - | - | - | - | - | - | - | - | I |

**Segregação Crítica:**
- Quem ingere eventos (sistema) ≠ Quem aprova correções (CFO/ADM)
- Quem configura fontes (ADM) ≠ Quem audita (AO)

---

### 4.2 Cálculo de Distribuição (Distribution Calculation)

| Atividade | SA | CFO | CCO | ADM | COMP | FC | OM | CO | TA | BA | FA | CA | LO | DI | RA | AO |
|-----------|----|-----|-----|-----|------|----|----|----|----|----|----|----|----|----|----|----|
| **Executar cálculo automático** | - | - | - | - | - | - | - | R | - | - | - | - | - | - | - | I |
| Validar fórmula de cálculo | - | - | - | - | C | A | - | - | R | C | - | - | - | - | - | I |
| Validar elegibilidade (DSL) | - | - | - | - | C | I | - | - | - | R | - | C | - | - | - | I |
| Aprovar resultado do cálculo | - | - | - | - | - | - | - | - | - | - | A | C | - | - | - | I |
| **Rejeitar cálculo (devolver para CO)** | - | - | - | - | - | - | - | - | - | - | R | C | - | - | - | I |
| Ajustar parâmetros de cálculo | - | A | C | R | C | I | I | - | - | - | - | - | - | - | - | I |
| Versionar matriz de distribuição | - | A | C | R | C | I | I | - | - | - | - | - | - | - | - | I |
| Testar nova versão de matriz (dry-run) | - | I | - | - | C | I | - | R | C | C | - | - | - | - | - | I |

**Segregação Crítica:**
- CO (calcula) ≠ FA (aprova financeiramente)
- CO (calcula) ≠ BA (aprova lógica de negócio)
- CO (calcula) ≠ TA (aprova tecnicamente)
- FC (controladoria) ≠ FA (aprovação financeira)

---

### 4.3 Workflow de Aprovação (Approval Workflow)

| Atividade | SA | CFO | CCO | ADM | COMP | FC | OM | CO | TA | BA | FA | CA | LO | DI | RA | AO |
|-----------|----|-----|-----|-----|------|----|----|----|----|----|----|----|----|----|----|----|
| **Iniciar workflow de aprovação** | - | - | - | - | - | - | - | R | - | - | - | - | - | - | - | I |
| Aprovação Técnica (idempotência, hash) | - | - | - | - | - | - | - | - | A | - | - | - | - | - | - | I |
| Aprovação de Negócio (matriz, elegibilidade) | - | - | - | - | - | - | - | - | - | A | - | - | - | - | - | I |
| Aprovação Financeira (valores, reservas) | - | - | - | - | - | - | - | - | - | - | A | - | - | - | - | I |
| Aprovação de Conformidade (regulatório) | - | - | - | - | - | - | - | - | - | - | - | A | - | - | - | I |
| **Aprovação Final (GO-LIVE)** | - | A | C | - | C | - | - | - | - | - | - | C | - | - | - | I |
| Rejeitar aprovação (qualquer nível) | - | - | - | - | - | - | - | - | R | R | R | R | - | - | - | I |
| Escalar disputa de aprovação | - | A | - | - | C | - | - | - | - | - | - | - | - | R | - | I |

**Regras de Workflow:**
1. **Ordem de aprovação:** TA → BA → FA → CA → CFO (final)
2. **Todas as aprovações são obrigatórias** (AND logic)
3. **Qualquer rejeição** devolve para o CO com comentários
4. **Timeout:** 24h por nível (SLA de aprovação)
5. **Escalonamento automático:** Após 24h sem resposta, notifica o nível superior

---

### 4.4 Liquidação (Settlement)

| Atividade | SA | CFO | CCO | ADM | COMP | FC | OM | CO | TA | BA | FA | CA | LO | DI | RA | AO |
|-----------|----|-----|-----|-----|------|----|----|----|----|----|----|----|----|----|----|----|
| **Gerar Settlement Instruction** | - | - | - | - | - | - | - | - | - | - | - | - | R | - | - | I |
| Validar Settlement Instruction | - | - | - | - | - | A | - | - | C | - | C | C | - | - | - | I |
| **Executar liquidação (LOWDATAESC)** | - | - | - | - | - | - | - | - | - | - | - | - | R | - | - | I |
| Confirmar liquidação (callback) | - | - | - | - | - | - | - | - | - | - | - | - | A | - | - | I |
| Tratar falha de liquidação | - | I | - | - | - | A | - | - | - | - | - | - | R | - | - | I |
| **Reprocessar liquidação (retry)** | - | - | - | - | - | - | - | - | - | - | - | - | R | - | - | I |
| **Cancelar liquidação (manual)** | - | A | C | - | C | A | - | - | - | - | - | C | - | - | - | I |
| Reconciliar liquidação com LOWDATAESC | - | - | - | - | - | A | - | - | - | - | - | - | R | - | C | I |

**Segregação Crítica:**
- LO (liquida) ≠ FA (aprova financeiramente)
- LO (liquida) ≠ FC (controladoria)
- LO (liquida) ≠ AO (auditoria)

---

### 4.5 Reconciliação (Reconciliation)

| Atividade | SA | CFO | CFO | ADM | COMP | FC | OM | CO | TA | BA | FA | CA | LO | DI | RA | AO |
|-----------|----|-----|-----|-----|------|----|----|----|----|----|----|----|----|----|----|----|
| **Executar reconciliação automática** | - | - | - | - | - | - | - | - | - | - | - | - | - | - | R | I |
| Identificar divergência | - | - | - | - | - | - | - | - | - | - | - | - | - | - | R | I |
| Classificar divergência (tipo, gravidade) | - | - | - | - | - | A | - | - | - | - | - | - | - | C | R | I |
| Investigar divergência | - | - | - | - | - | - | - | - | - | - | - | - | - | R | C | I |
| **Ajustar divergência (manual)** | - | A | - | - | - | A | - | - | - | - | - | - | - | - | R | I |
| Aprovar ajuste de reconciliação | - | - | - | - | - | A | - | - | - | - | - | - | - | - | - | I |
| Escalar divergência não resolvida | - | A | C | - | C | - | - | - | - | - | - | - | - | - | R | I |
| Gerar relatório de reconciliação | - | I | - | - | - | A | - | - | - | - | - | - | - | - | R | I |

**Regras de Reconciliação:**
1. **Tolerância:** R$ 0.01 (1 centavo) para divergências
2. **Periodicidade:** Diária (automática) + Mensal (auditada)
3. **Escalonamento:** Divergências > R$ 1000 exigem aprovação do CFO
4. **Resolução:** Máximo 48h para divergências críticas

---

### 4.6 Disputas (Disputes)

| Atividade | SA | CFO | CCO | ADM | COMP | FC | OM | CO | TA | BA | FA | CA | LO | DI | RA | AO |
|-----------|----|-----|-----|-----|------|----|----|----|----|----|----|----|----|----|----|----|
| **Abrir disputa** | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | I |
| Classificar disputa (tipo, prioridade) | - | - | - | - | C | - | - | - | - | - | - | - | - | R | - | I |
| Investigar disputa | - | - | - | - | C | - | - | - | - | - | - | - | - | R | C | I |
| Coletar evidências (hash chain, logs) | - | - | - | - | - | - | - | - | - | - | - | - | - | R | - | C |
| **Propor resolução** | - | - | - | - | - | - | - | - | - | - | - | - | - | R | - | I |
| Aprovar resolução de disputa | - | A | C | - | C | - | - | - | - | - | - | C | - | - | - | I |
| Executar resolução (ajuste, estorno) | - | - | - | - | - | A | - | - | - | - | - | - | R | - | - | I |
| Fechar disputa | - | - | - | - | - | - | - | - | - | - | - | - | - | R | - | I |
| Arquivar disputa | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | R |

**Regras de Disputas:**
1. **Prioridades:** Crítica (2h) | Alta (24h) | Média (72h) | Baixa (7d)
2. **Tipos:** Fraude, Erro de Cálculo, Erro de Liquidação, Divergência de Reconciliação, Chargeback
3. **Evidências:** Hash chain, logs de auditoria, provas de LOWDATAESC
4. **Resolução:** Sempre requer aprovação do CFO para valores > R$ 10.000

---

### 4.7 Gestão de Matriz de Distribuição

| Atividade | SA | CFO | CCO | ADM | COMP | FC | OM | CO | TA | BA | FA | CA | LO | DI | RA | AO |
|-----------|----|-----|-----|-----|------|----|----|----|----|----|----|----|----|----|----|----|
| **Propor nova versão de matriz** | - | - | - | - | - | - | - | - | - | R | - | - | - | - | - | I |
| Validar DSL de elegibilidade | - | - | - | - | C | - | - | - | - | R | - | C | - | - | - | I |
| Testar nova versão (dry-run) | - | - | - | - | - | I | - | R | C | - | - | - | - | - | - | I |
| Aprovar nova versão | - | A | C | - | C | - | - | - | - | - | - | C | - | - | - | I |
| **Deploy nova versão** | - | - | - | R | - | - | - | - | - | - | - | - | - | - | - | I |
| Rollback de versão | - | A | C | R | - | - | - | - | - | - | - | - | - | - | - | I |
| Auditar versão ativa | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | R |

**Regras de Versionamento:**
1. **Semantic Versioning:** MAJOR (breaking changes) | MINOR (new features) | PATCH (bug fixes)
2. **Dry-run obrigatório** para qualquer mudança
3. **Aprovação mínima:** BA + FA + CA + CFO
4. **Rollback automático** em caso de falha crítica
5. **Retention:** Mínimo 7 anos de todas as versões

---

### 4.8 Operações e Manutenção

| Atividade | SA | CFO | CCO | ADM | COMP | FC | OM | CO | TA | BA | FA | CA | LO | DI | RA | AO |
|-----------|----|-----|-----|-----|------|----|----|----|----|----|----|----|----|----|----|----|
| Monitorar saúde dos serviços | - | - | - | R | - | - | A | - | - | - | - | - | - | - | - | I |
| Gerenciar incidentes | - | I | - | R | - | - | A | - | - | - | - | - | - | - | - | I |
| Aplicar patches de segurança | - | - | - | R | - | - | A | - | - | - | - | - | - | - | - | I |
| Configurar backups | - | - | - | R | - | - | A | - | - | - | - | - | - | - | - | I |
| Testar restore de backup | - | - | - | R | - | - | A | - | - | - | - | - | - | - | - | I |
| Rotacionar chaves criptográficas | - | - | - | R | - | - | A | - | - | - | - | - | - | - | - | I |
| Auditar logs de acesso | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | R |

---

## 5. Matriz de Segregação de Funções (SoD)

### 5.1 Regras de Segregação Crítica

| Regra | Descrição | Roles Conflitantes |
|-------|-----------|---------------------|
| SoD-001 | **Quem calcula não aprova** | CO ≠ TA, BA, FA, CA |
| SoD-002 | **Quem aprova não executa** | TA, BA, FA, CA ≠ CO, LO |
| SoD-003 | **Quem liquida não aprova liquidação** | LO ≠ FA, CFO |
| SoD-004 | **Quem audita não modifica** | AO ≠ SA, ADM, CO, LO |
| SoD-005 | **Quem controla não aprova financeiramente** | FC ≠ FA, CFO |
| SoD-006 | **Quem configura não audita** | ADM ≠ AO |
| SoD-007 | **Quem resolve disputas não liquida** | DI ≠ LO |
| SoD-008 | **Quem reconcilia não aprova ajustes** | RA ≠ FC, CFO |

### 5.2 Verificação de Conformidade SoD

```yaml
# Exemplo de verificação automática (OPA/Rego)
package revenue_share.sod

deny[msg] {
  user := input.user
  action := input.action
  
  # SoD-001: CO cannot approve
  user.roles[_] == "Calculation Operator"
  action in ["approve_technical", "approve_business", "approve_financial", "approve_compliance"]
  msg := sprintf("SoD-001 Violation: CO cannot %s", [action])
}

deny[msg] {
  user := input.user
  action := input.action
  
  # SoD-002: Approvers cannot execute
  user.roles[_] in ["Technical Approver", "Business Approver", "Financial Approver", "Compliance Approver"]
  action in ["calculate", "liquidate"]
  msg := sprintf("SoD-002 Violation: Approver cannot %s", [action])
}
```

---

## 6. Fluxo de Escalonamento

### 6.1 Hierarquia de Escalonamento

```
┌─────────────────────────────────────────────────────────────────┐
│                    ESCALONAMENTO OPERACIONAL                     │
├─────────────────────────────────────────────────────────────────┤
│  L3 (Operacional) → L2 (Tático) → L1 (Estratégico)              │
│  Timeout: 24h por nível                                          │
│  Crítico: 2h (direto para L1)                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Matriz de Escalonamento

| Situação | Nível Inicial | Timeout | Próximo Nível | Notificação |
|----------|---------------|---------|---------------|-------------|
| Aprovação pendente | TA/BA/FA/CA | 24h | CFO | Email + Slack |
| Divergência de reconciliação > R$ 1000 | RA | 24h | FC | Email + PagerDuty |
| Divergência de reconciliação > R$ 10.000 | RA | Imediato | CFO | Email + PagerDuty + Phone |
| Disputa crítica | DI | 2h | CFO | Email + PagerDuty + Phone |
| Falha de liquidação | LO | 1h | FC | Email + PagerDuty |
| Incidente de segurança | OM | Imediato | CCO | Email + PagerDuty + Phone |
| Falha de ingestão | ADM | 1h | OM | Email + Slack |

---

## 7. Decisão e Autoridade

### 7.1 Matriz de Autoridade de Decisão

| Tipo de Decisão | Authority | Aprovação Mínima | Documentação Requerida |
|-----------------|-----------|------------------|------------------------|
| Mudança de matriz de distribuição | CFO | BA + FA + CA + CFO | Dry-run + Test Report |
| Ajuste manual de cálculo | CFO | FC + FA + CFO | Justificativa + Evidências |
| Cancelamento de liquidação | CFO | FC + FA + CFO | Justificativa + Impacto |
| Resolução de disputa > R$ 10.000 | CFO | DI + FC + CFO | Relatório de Investigação |
| Rollback de versão | CFO | ADM + CFO | Incident Report |
| Mudança de configuração crítica | ADM | OM + ADM | Change Request |
| Rotação de chaves | ADM | OM + ADM | Security Audit Log |

### 7.2 Quorum de Aprovação

| Ação | Quorum Mínimo | Roles Requeridos |
|------|---------------|-------------------|
| Deploy de nova versão | 4/5 | BA + FA + CA + CFO + (TA ou ADM) |
| Aprovação de cálculo | 4/4 | TA + BA + FA + CA |
| Liquidação | 2/2 | FA + LO |
| Resolução de disputa | 3/4 | DI + FC + FA + CFO |
| Ajuste de reconciliação | 2/2 | RA + FC |

---

## 8. Comunicação e Relatórios

### 8.1 Canais de Comunicação

| Tipo | Canal | Frequência | Responsável |
|------|-------|------------|-------------|
| Alertas críticos | PagerDuty + Phone | Imediato | OM |
| Alertas operacionais | Slack #revenue-share-alerts | Imediato | OM |
| Relatórios diários | Email + Slack #revenue-share-daily | Diário 08:00 | OM |
| Relatórios de reconciliação | Email + Dashboard | Diário | FC |
| Relatórios de conformidade | Email + Confluence | Semanal | COMP |
| Relatórios de auditoria | Email + SIEM | Mensal | AO |
| Relatórios executivos | Email + Dashboard | Mensal | CFO |

### 8.2 Relatórios Obrigatórios

| Relatório | Frequência | Responsável | Destinatários |
|-----------|------------|-------------|---------------|
| Reconciliação Diária | Diário | FC | CFO, COMP, OM |
| Incident Report | Por incidente | OM | CFO, CCO, ADM |
| Dispute Resolution Report | Por disputa | DI | CFO, FC, COMP |
| Matriz Version Change Report | Por mudança | BA | CFO, ADM, AO |
| SLA Compliance Report | Mensal | OM | CFO, ADM |
| Security Audit Report | Trimestral | AO | CCO, ADM |
| Regulatory Compliance Report | Trimestral | COMP | CCO, CFO |

---

## 9. Anexos

### 9.1 Glossário de Termos RACI

| Termo | Definição |
|-------|-----------|
| **RACI** | Framework de definição de responsabilidades (Responsible, Accountable, Consulted, Informed) |
| **SoD** | Segregation of Duties - Princípio de separação de funções para prevenir fraudes |
| **Quorum** | Número mínimo de aprovações requeridas para uma ação |
| **Dry-run** | Teste de uma nova versão sem impacto em produção |
| **Rollback** | Reversão de uma mudança para a versão anterior |

### 9.2 Referências Externas

- [RBAC-POLICY.md](../security/RBAC-POLICY.md) - Definição completa de roles e permissões
- [STATE-MACHINE.md](../docs/STATE-MACHINE.md) - Máquina de estados do módulo
- [DRF-REVENUE-SHARE.md](../docs/DRF-REVENUE-SHARE.md) - Requisitos funcionais
- [RNF-REVENUE-SHARE.md](../docs/RNF-REVENUE-SHARE.md) - Requisitos não-funcionais
- [ARCHITECTURE-REFERENCE.md](../specs/ARCHITECTURE-REFERENCE.md) - Arquitetura técnica

---

## 10. Controle de Versão

| Versão | Data | Autor | Mudanças | Aprovação |
|--------|------|-------|----------|-----------|
| 1.0.0 | 2024-11-02 | Vibe Code | Criação inicial | Pendente |

---

## 11. Aprovações

| Role | Nome | Assinatura | Data |
|------|------|------------|------|
| Chief Financial Officer | [CFO Name] | __________ | _____ |
| Chief Compliance Officer | [CCO Name] | __________ | _____ |
| Super Admin | [SA Name] | __________ | _____ |

---

*Este documento é classificado como **Confidencial** e deve ser armazenado com controle de acesso adequado.*
*Qualquer cópia ou distribuição deve ser autorizada pelo CFO ou CCO.*
