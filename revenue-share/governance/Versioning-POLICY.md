# Politica de Versionamento de Regras - Revenue Share Module
## Versao: 1.0.0 | Data: 2024-11-02 | Classificacao: Confidencial

---

## 1. Introducao

### 1.1 Proposito
Esta politica define os padroes e procedimentos para **versionamento de regras de distribuicao** no modulo Revenue Share, garantindo:

- **Rastreabilidade** de todas as mudancas em regras financeiras
- **Controle de versao** com semantic versioning (SemVer)
- **Aprovacao formal** antes de deploy em producao
- **Testes automatizados** (dry-run) para validacao
- **Rollback seguro** em caso de falhas
- **Conformidade regulatoria** (BCB, CVM, SUSEP)
- **Auditoria completa** via hash chain

### 1.2 Escopo
Aplica-se a:
- **Matriz de Distribuicao** (percentuais, participantes, pisos, tetos)
- **Regras de Elegibilidade** (DSL - Domain Specific Language)
- **Fórmulas de Calculo** (deducoes, reservas, arredondamentos)
- **Regras de Reconciliacao** (tolerancias, periodicidade)
- **Regras de Disputas** (prioridades, SLAs)

### 1.3 Definicoes

| Termo | Definicao |
|-------|-----------|
| **Matriz de Distribuicao** | Conjunto de regras que definem como a receita e distribuida entre participantes |
| **Versao** | Identificador unico de uma configuracao de regras (ex: 1.0.0) |
| **Dry-run** | Teste de uma nova versao com dados historicos sem impacto em producao |
| **Deploy** | Ativacao de uma nova versao em producao |
| **Rollback** | Reversao para uma versao anterior |
| **Effective Date** | Data em que a versao entra em vigor |
| **Deprecation Date** | Data em que a versao e descontinuada |
| **DSL** | Domain Specific Language para definicao de regras de elegibilidade |

---

## 2. Estrutura de Versionamento

### 2.1 Semantic Versioning (SemVer)

Todas as versoes seguem o padrao **Semantic Versioning 2.0.0**:

```
MAJOR.MINOR.PATCH
```

| Componente | Incremento | Descricao |
|------------|------------|-----------|
| **MAJOR** | X.0.0 | Mudancas incompatíveis (breaking changes) |
| **MINOR** | 0.X.0 | Novas funcionalidades (backward compatible) |
| **PATCH** | 0.0.X | Correcoes de bugs (backward compatible) |

**Exemplos:**
- `1.0.0`: Versao inicial
- `1.1.0`: Nova funcionalidade (ex: novo tipo de participante)
- `1.1.1`: Correcao de bug (ex: fix em calculo de reserva)
- `2.0.0`: Mudanca incompatível (ex: nova formula de distribuicao)

---

### 2.2 Tipos de Mudancas

#### MAJOR (Breaking Changes)
Mudancas que **quebram compatibilidade** com versoes anteriores:

| Tipo | Exemplo | Impacto |
|------|---------|---------|
| Mudanca na formula base | Alterar de `Receita Liquida - Reservas` para `Receita Bruta - Deducoes` | Recalculo de todos os valores |
| Remocao de participantes | Remover um participante da matriz | Liquidacoes futuras mudam |
| Mudanca em pisos/tetos | Alterar piso de 0% para 5% | Distribuicoes futuras mudam |
| Mudanca no DSL | Alterar sintaxe da DSL de elegibilidade | Regras existentes podem quebrar |
| Mudanca em moedas | Adicionar/remover suporte a moeda | Impacto em conversoes |

**Requisitos para MAJOR:**
- [ ] Aprovacao do **CFO** (obrigatoria)
- [ ] Aprovacao do **CCO** (obrigatoria)
- [ ] Aprovacao do **Board** (se impacto > 10% da receita)
- [ ] Dry-run com **todos os dados historicos**
- [ ] Plano de migracao para dados existentes
- [ ] Comunicacao com **30 dias de antecedencia**

---

#### MINOR (New Features)
Mudancas que **adicionam funcionalidades** sem quebrar compatibilidade:

| Tipo | Exemplo | Impacto |
|------|---------|---------|
| Adicao de participantes | Adicionar novo investidor | Apenas afeta liquidacoes futuras |
| Novos tipos de deducoes | Adicionar deducao de taxa administrativa | Opcional para calculos |
| Novos tipos de reservas | Adicionar reserva de contingencia | Opcional para calculos |
| Novas funcoes no DSL | Adicionar funcao `isActive()` | Extende funcionalidade |
| Novos parametros | Adicionar parametro `cliff_date` | Opcional |

**Requisitos para MINOR:**
- [ ] Aprovacao do **CFO** (obrigatoria)
- [ ] Aprovacao do **BA** (Business Approver)
- [ ] Aprovacao do **FA** (Financial Approver)
- [ ] Dry-run com **dados dos ultimos 3 meses**
- [ ] Comunicacao com **7 dias de antecedencia**

---

#### PATCH (Bug Fixes)
Mudancas que **corrigem bugs** sem adicionar funcionalidades:

| Tipo | Exemplo | Impacto |
|------|---------|---------|
| Correcao de calculo | Fix em arredondamento | Ajuste em valores |
| Correcao de elegibilidade | Fix em regra de participante | Participantes corretos |
| Correcao de reserva | Fix em calculo de reserva | Valores corretos |
| Correcao de prioridade | Fix em ordem de aplicacao | Ordem correta |

**Requisitos para PATCH:**
- [ ] Aprovacao do **BA** (Business Approver)
- [ ] Aprovacao do **FA** (Financial Approver)
- [ ] Dry-run com **dados dos ultimos 7 dias**
- [ ] Comunicacao **imediata** (se critico) ou **24h** (se nao critico)

---

## 3. Ciclo de Vida de uma Versao

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CICLO DE VIDA DE UMA VERSAO                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │   DRAFT      │────▶│   PROPOSTA   │────▶│   APROVACAO  │                │
│  │              │     │              │     │              │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│          │                    │                    │                         │
│          ▼                    ▼                    ▼                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │  TESTE       │◀────│  REVISAO     │     │   DRY-RUN    │                │
│  │  (DEV)       │     │              │     │              │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│          │                    │                    │                         │
│          ▼                    ▼                    ▼                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │  STAGING     │────▶│  PRE-PROD    │────▶│   PRODUCAO   │                │
│  │              │     │              │     │              │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│          │                    │                    │                         │
│          ▼                    ▼                    ▼                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │  ATIVA       │     │  DEPRECATED  │     │   ARQUIVADA  │                │
│  │              │────▶│              │────▶│              │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.1 Fases do Ciclo de Vida

#### Fase 1: Draft (Rascunho)
**Responsavel:** Business Approver (BA) ou Financial Approver (FA)

**Atividades:**
1. Criar nova versao no sistema de versionamento
2. Definir mudancas em relacao a versao atual
3. Documentar justificativa das mudancas
4. Definir **Effective Date** (data de entrada em vigor)

**Exemplo:**
```yaml
version: 1.1.0
status: DRAFT
type: MINOR
description: "Ajuste de percentuais para Pre-Seed"
effective_date: "2024-12-01"
changes:
  - type: PARTICIPANT_PERCENTAGE
    participant_id: "pre-seed-001"
    old_value: 0.67
    new_value: 0.65
  - type: PARTICIPANT_PERCENTAGE
    participant_id: "founders-001"
    old_value: 0.33
    new_value: 0.35
proposed_by: "ba-001"
proposed_at: "2024-11-02T10:00:00Z"
```

---

#### Fase 2: Proposta
**Responsavel:** BA ou FA

**Atividades:**
1. Submeter versao para revisao
2. Notificar interessados (CFO, FC, COMP, AO)
3. Aguardar feedback

**Template de Notificacao:**
```
Assunto: [VERSIONAMENTO] Proposta de Nova Versao - Matriz de Distribuicao v1.1.0

Prezados,

Foi proposta uma nova versao da matriz de distribuicao:

Versao: 1.1.0
Tipo: MINOR
Descricao: Ajuste de percentuais para Pre-Seed
Effective Date: 2024-12-01

Mudancas:
- Pre-Seed: 67% -> 65%
- Founders: 33% -> 35%

Justificativa: Alinhamento com nova rodada de investimento.

Por favor, revisem e fornecam feedback ate <DATA>.

Link para revisao: https://matrix-service.revenue-share.svc.cluster.local:8443/versions/1.1.0

Atenciosamente,
[BA Name]
```

---

#### Fase 3: Revisao
**Responsavel:** CFO, FC, COMP, AO

**Atividades:**
1. Revisar mudancas propostas
2. Validar impacto financeiro
3. Validar conformidade regulatoria
4. Validar impacto em auditoria
5. Fornecer feedback ou aprovar

**Checklist de Revisao:**
- [ ] Mudancas estao alinhadas com a estrategias de negocio
- [ ] Impacto financeiro foi calculado e e aceitavel
- [ ] Conformidade com BCB/CVM/SUSEP e mantida
- [ ] DSL de elegibilidade e valida
- [ ] Pisos e tetos estao corretos
- [ ] Participantes estao corretamente definidos
- [ ] Data de entrada em vigor e adequada

---

#### Fase 4: Aprovacao
**Responsavel:** Aprovadores (ver RACI-MATRIX.md)

**Fluxo de Aprovacao:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO DE APROVACAO DE VERSAO                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  MAJOR (2.0.0):                                                  │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐            │
│  │   BA    │──▶│   FA    │──▶│   CA    │──▶│  CFO    │──▶ DEPLOY│
│  └─────────┘   └─────────┘   └─────────┘   └─────────┘            │
│       │             │             │             │                │
│       ▼             ▼             ▼             ▼                │
│  (Business)   (Financial)   (Compliance)   (Final)               │
│                                                                  │
│  MINOR (1.1.0):                                                  │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐            │
│  │   BA    │──▶│   FA    │──▶│   CA    │──▶│  CFO    │──▶ DEPLOY│
│  └─────────┘   └─────────┘   └─────────┘   └─────────┘            │
│                                                                  │
│  PATCH (1.0.1):                                                  │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐                            │
│  │   BA    │──▶│   FA    │──▶│   TA    │──▶ DEPLOY                 │
│  └─────────┘   └─────────┘   └─────────┘                            │
│       │             │             │                              │
│  (Business)   (Financial)   (Technical)                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Requisitos de Aprovacao:**
| Tipo | BA | FA | CA | TA | CFO | Quorum |
|------|----|----|----|----|-----|--------|
| MAJOR | ✅ | ✅ | ✅ | - | ✅ | 5/5 |
| MINOR | ✅ | ✅ | ✅ | - | ✅ | 5/5 |
| PATCH | ✅ | ✅ | - | ✅ | - | 3/3 |

**Template de Aprovacao:**
```yaml
version: 1.1.0
approvals:
  - role: Business_Approver
    user_id: "ba-001"
    approved: true
    comments: "Percentuais alinhados com negociacao Pre-Seed"
    approved_at: "2024-11-02T12:00:00Z"
  - role: Financial_Approver
    user_id: "fa-001"
    approved: true
    comments: "Impacto financeiro aceitavel"
    approved_at: "2024-11-02T12:30:00Z"
  - role: Compliance_Approver
    user_id: "ca-001"
    approved: true
    comments: "Conformidade com CVM verificada"
    approved_at: "2024-11-02T13:00:00Z"
  - role: Chief_Financial_Officer
    user_id: "cfo-001"
    approved: true
    comments: "Aprovado para deploy"
    approved_at: "2024-11-02T13:30:00Z"
status: APPROVED
```

---

#### Fase 5: Dry-Run (Teste)
**Responsavel:** Calculation Operator (CO)

**Atividades:**
1. Executar dry-run com dados historicos
2. Comparar resultados com versao atual
3. Validar consistencia
4. Gerar relatorio de teste

**Procedimento:**
```bash
# 1. Executar dry-run
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.1.0",
    "dry_run_period": "2024-10-01/2024-10-31",
    "idempotency_key": "dryrun-1.1.0-20241102"
  }' \
  https://matrix-service.revenue-share.svc.cluster.local:8443/api/v1/matrix/versions/dry-run

# 2. Comparar resultados
curl -H "Authorization: Bearer $TOKEN" \
  https://matrix-service.revenue-share.svc.cluster.local:8443/api/v1/matrix/versions/compare?version1=1.0.0&version2=1.1.0

# 3. Verificar hash chain
curl -H "Authorization: Bearer $TOKEN" \
  https://audit-service.revenue-share.svc.cluster.local:8443/api/v1/audit/verify?version=1.1.0
```

**Relatorio de Dry-Run:**
```markdown
# Relatorio de Dry-Run - Versao 1.1.0

## Periodo Testado
- Inicio: 2024-10-01
- Fim: 2024-10-31

## Resultados
| Metrica | Versao 1.0.0 | Versao 1.1.0 | Diferenca |
|---------|--------------|--------------|-----------|
| Total Distribuido | R$ 1.000.000,00 | R$ 1.000.000,00 | R$ 0,00 |
| Participante A | R$ 670.000,00 | R$ 650.000,00 | -R$ 20.000,00 |
| Participante B | R$ 330.000,00 | R$ 350.000,00 | +R$ 20.000,00 |

## Validacoes
- [x] Soma de distribuicoes = Total
- [x] Pisos e tetos respeitados
- [x] Elegibilidade validada
- [x] Hash chain consistente
- [x] Reservas aplicadas corretamente

## Conclusao
✅ Dry-run aprovado. Versao 1.1.0 esta pronta para deploy.

## Evidencias
- Logs: s3://revenue-share-logs/dry-run/1.1.0/
- Hash: sha256:abc123...
```

---

#### Fase 6: Deploy
**Responsavel:** Admin (ADM)

**Atividades:**
1. Deployar versao em producao
2. Verificar deploy
3. Monitorar primeiros calculos
4. Notificar interessados

**Procedimento:**
```bash
# 1. Deploy (ADM)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.1.0",
    "deployed_by": "adm-001",
    "comments": "Deploy em producao"
  }' \
  https://matrix-service.revenue-share.svc.cluster.local:8443/api/v1/matrix/versions/deploy

# 2. Verificar deploy
curl -H "Authorization: Bearer $TOKEN" \
  https://matrix-service.revenue-share.svc.cluster.local:8443/api/v1/matrix/versions/active

# 3. Monitorar
kubectl -n revenue-share logs -l app=calculation-service --tail=100 | grep "matrix_version=1.1.0"

# 4. Notificar
# - Email para interessados
# - Slack #matrix-updates
```

**Template de Notificacao de Deploy:**
```
Assunto: [VERSIONAMENTO] Deploy de Nova Versao - Matriz de Distribuicao v1.1.0

Prezados,

A versao 1.1.0 da matriz de distribuicao foi deployada em producao as <HORA>.

Versao: 1.1.0
Effective Date: 2024-12-01
Deployed By: adm-001

Mudancas:
- Pre-Seed: 67% -> 65%
- Founders: 33% -> 35%

Primeiros calculos com a nova versao estao sendo monitorados.

Link para detalhes: https://matrix-service.revenue-share.svc.cluster.local:8443/versions/1.1.0

Atenciosamente,
[ADM Name]
```

---

#### Fase 7: Ativa
**Status:** Versao em uso em producao

**Atividades:**
1. Monitorar performance
2. Monitorar erros
3. Coletar feedback
4. Documentar issues

---

#### Fase 8: Deprecated
**Trigger:** Nova versao MAJOR deployada

**Atividades:**
1. Marcar versao como DEPRECATED
2. Definir **Deprecation Date** (30 dias apos deploy da nova versao)
3. Notificar usuarios
4. Monitorar uso

**Template de Notificacao de Deprecation:**
```
Assunto: [VERSIONAMENTO] Deprecation Warning - Matriz de Distribuicao v1.0.0

Prezados,

A versao 1.0.0 da matriz de distribuicao sera descontinuada em <DATA>.

Por favor, migrem para a versao 1.1.0 ate essa data.

Versao Atual: 1.0.0
Nova Versao: 1.1.0
Deprecation Date: <DATA>

Apos a data de deprecation, a versao 1.0.0 nao sera mais suporte e podera ser removida.

Atenciosamente,
[ADM Name]
```

---

#### Fase 9: Arquivada
**Trigger:** 90 dias apos Deprecation Date

**Atividades:**
1. Arquivar versao
2. Manter para auditoria (7 anos)
3. Remover de ambientes nao-producao

---

## 4. Rollback

### 4.1 Procedimento de Rollback
**Trigger:** Falha critica com nova versao

**Responsavel:** ADM ou CFO

**Procedimento:**
```bash
# 1. Identificar versao para rollback
curl -H "Authorization: Bearer $TOKEN" \
  https://matrix-service.revenue-share.svc.cluster.local:8443/api/v1/matrix/versions/active

# 2. Executar rollback
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.1.0",
    "rollback_to": "1.0.0",
    "reason": "Falha critica em calculo. Rollback emergencial.",
    "approved_by": "cfo-001"
  }' \
  https://matrix-service.revenue-share.svc.cluster.local:8443/api/v1/matrix/versions/rollback

# 3. Verificar rollback
curl -H "Authorization: Bearer $TOKEN" \
  https://matrix-service.revenue-share.svc.cluster.local:8443/api/v1/matrix/versions/active

# 4. Notificar interessados
# - Email + Slack
```

**Template de Notificacao de Rollback:**
```
Assunto: [URGENTE] Rollback - Matriz de Distribuicao v1.1.0

Prezados,

A versao 1.1.0 da matriz de distribuicao foi revertida para a versao 1.0.0 as <HORA>.

Motivo: <RAZAO>
Rollback To: 1.0.0
Approved By: <APROVADOR>

O time tecnico esta investigando a causa do problema.

Atenciosamente,
[ADM Name]
```

---

### 4.2 Causas de Rollback

| Causa | Severidade | Acao |
|-------|------------|------|
| Erro de calculo | Critico | Rollback imediato |
| Erro de elegibilidade | Critico | Rollback imediato |
| Erro de reserva | Alto | Rollback em ate 1h |
| Performance degradada | Alto | Rollback em ate 1h |
| Erro de conformidade | Critico | Rollback imediato |
| Erro de integracao | Alto | Rollback em ate 1h |

---

## 5. Controle de Versao e Auditoria

### 5.1 Hash Chain para Versionamento

Todas as versoes sao **imutaveis** e fazem parte da hash chain de auditoria:

```
Versao 1.0.0: hash_1 = SHA256(versao_1.0.0_data)
Versao 1.1.0: hash_2 = SHA256(versao_1.1.0_data + hash_1)
Versao 2.0.0: hash_3 = SHA256(versao_2.0.0_data + hash_2)
```

**Beneficios:**
- **Imutabilidade:** Versoes nao podem ser alteradas
- **Rastreabilidade:** Historico completo de mudancas
- **Auditoria:** Verificacao de integridade
- **Conformidade:** Atende requisitos regulatorios

---

### 5.2 Armazenamento de Versoes

| Dado | Armazenamento | Retencao | Formato |
|------|--------------|----------|---------|
| Configuracao da versao | PostgreSQL | 7 anos | JSON |
| Metadados (aprovacoes, etc.) | PostgreSQL | 7 anos | JSON |
| Hash chain | S3 (WORM) | 7 anos | Binario |
| Relatorios de dry-run | S3 | 7 anos | PDF/JSON |
| Logs de deploy | S3 | 7 anos | TXT |

---

### 5.3 Auditoria de Versoes

**Procedimento de Auditoria:**
```bash
# 1. Listar todas as versoes
curl -H "Authorization: Bearer $TOKEN" \
  https://matrix-service.revenue-share.svc.cluster.local:8443/api/v1/matrix/versions

# 2. Verificar hash chain
curl -H "Authorization: Bearer $TOKEN" \
  https://audit-service.revenue-share.svc.cluster.local:8443/api/v1/audit/verify?type=matrix_version

# 3. Verificar aprovacoes
curl -H "Authorization: Bearer $TOKEN" \
  https://matrix-service.revenue-share.svc.cluster.local:8443/api/v1/matrix/versions/<VERSION>/approvals

# 4. Verificar dry-run
curl -H "Authorization: Bearer $TOKEN" \
  https://matrix-service.revenue-share.svc.cluster.local:8443/api/v1/matrix/versions/<VERSION>/dry-run
```

---

## 6. Seguranca e Controle de Acesso

### 6.1 RBAC para Versionamento

| Role | Permissao | Acao |
|------|------------|------|
| Super Admin | Full Access | Criar, ler, atualizar, deletar, aprovar, deployar |
| Admin | Full Access (exceto delete) | Criar, ler, atualizar, aprovar, deployar |
| CFO | Approve + Read | Aprovar, ler |
| BA | Create + Read + Approve (MINOR/PATCH) | Criar, ler, aprovar (MINOR/PATCH) |
| FA | Read + Approve (MINOR/PATCH) | Ler, aprovar (MINOR/PATCH) |
| CA | Read + Approve | Ler, aprovar |
| TA | Read + Approve (PATCH) | Ler, aprovar (PATCH) |
| CO | Read + Dry-run | Ler, executar dry-run |
| OM | Read | Ler |
| AO | Read + Audit | Ler, auditar |

---

### 6.2 Controle de Mudancas

**Requisitos para Mudancas:**
1. **Autenticacao:** Todas as acoes requerem autenticacao (mTLS + JWT)
2. **Autorizacao:** Todas as acoes requerem autorizacao (RBAC + OPA)
3. **Audit Trail:** Todas as acoes sao auditadas (hash chain)
4. **Idempotencia:** Todas as acoes sao idempotentes
5. **Justificativa:** Todas as mudancas requerem justificativa

**Exemplo de Log de Auditoria:**
```json
{
  "timestamp": "2024-11-02T14:00:00Z",
  "action": "CREATE_VERSION",
  "user_id": "ba-001",
  "version": "1.1.0",
  "ip": "10.0.0.1",
  "user_agent": "Mozilla/5.0",
  "metadata": {
    "justification": "Ajuste de percentuais para Pre-Seed",
    "changes": [
      {"type": "PARTICIPANT_PERCENTAGE", "participant_id": "pre-seed-001", "old_value": 0.67, "new_value": 0.65}
    ]
  },
  "hash": "sha256:abc123...",
  "previous_hash": "sha256:def456..."
}
```

---

## 7. Conformidade Regulatoria

### 7.1 Requisitos por Regulador

| Regulador | Requisito | Como Atendemos |
|-----------|-----------|----------------|
| **BCB** | Rastreabilidade de mudancas | Hash chain + Audit Trail |
| **CVM** | Aprovacao formal de mudancas | Fluxo de aprovacao (CFO/BA/FA/CA) |
| **SUSEP** | Controle de versao | Semantic Versioning |
| **ANPD** | Protecao de dados | Criptografia + Controle de acesso |
| **LGPD** | Consentimento para mudancas | Notificacao com antecedencia |

---

### 7.2 Documentacao para Auditoria

Os seguintes documentos devem ser mantidos para auditoria:

1. **Registro de Versoes:**
   - Lista de todas as versoes
   - Mudancas em cada versao
   - Justificativa das mudancas

2. **Registro de Aprovacoes:**
   - Quem aprovou cada versao
   - Quando foi aprovada
   - Comentarios dos aprovadores

3. **Registro de Dry-run:**
   - Periodo testado
   - Resultados
   - Validacoes executadas

4. **Registro de Deploy:**
   - Quando foi deployada
   - Quem deployou
   - Evidencias de monitoramento

5. **Registro de Rollback:**
   - Quando foi feito rollback
   - Quem autorizou
   - Motivo do rollback

---

## 8. Procedimentos de Emergencia

### 8.1 Rollback de Emergencia
**Trigger:** Falha critica que nao pode esperar por aprovacao formal

**Responsavel:** CFO ou ADM

**Procedimento:**
1. Executar rollback imediato (sem dry-run)
2. Notificar CFO e CCO
3. Investigar causa
4. Documentar incidente
5. Corrigir problema
6. Re-deployar versao corrigida

---

### 8.2 Freeze de Versoes
**Trigger:** Periodo critico (ex: fechamento mensal, auditoria)

**Responsavel:** CFO

**Procedimento:**
1. Congelar versoes ativas
2. Proibir novos deploys
3. Notificar time
4. Monitorar sistema
5. Liberar freeze apos periodo critico

**Template de Notificacao de Freeze:**
```
Assunto: [VERSIONAMENTO] FREEZE - Matriz de Distribuicao

Prezados,

As versoes da matriz de distribuicao estao CONGELADAS ate <DATA>.

Motivo: <MOTIVO> (ex: Fechamento mensal)

Nenhum novo deploy sera permitido durante este periodo.

Em caso de emergencia, contactar o CFO.

Atenciosamente,
[CFO Name]
```

---

## 9. Monitoramento e Relatorios

### 9.1 Metricas de Versionamento

| Metrica | Descricao | SLI | SLO | SLA |
|---------|-----------|-----|-----|-----|
| Tempo medio de aprovacao | Tempo entre proposta e aprovacao | < 24h | < 48h | < 72h |
| Taxa de rollback | % de deploys que requerem rollback | < 1% | < 5% | < 10% |
| Tempo medio de dry-run | Tempo para executar dry-run | < 1h | < 2h | < 4h |
| Tempo medio de deploy | Tempo entre aprovacao e deploy | < 1h | < 2h | < 4h |
| Versoes ativas | Numero de versoes em uso | <= 2 | <= 3 | <= 5 |

---

### 9.2 Relatorios

#### Relatorio Mensal de Versionamento
**Frequencia:** Mensal (1o dia util)
**Responsavel:** OM

```markdown
# Relatorio Mensal de Versionamento - Revenue Share
**Mes:** Novembro 2024

## Resumo
- **Versoes criadas:** 3
- **Versoes deployadas:** 2
- **Versoes em dry-run:** 1
- **Rollbacks:** 0

## Versoes Deployadas
| Versao | Tipo | Data | Effective Date | Mudancas |
|--------|------|------|----------------|----------|
| 1.1.0 | MINOR | 2024-11-02 | 2024-12-01 | Ajuste de percentuais |
| 1.0.1 | PATCH | 2024-11-01 | 2024-11-01 | Fix em arredondamento |

## Metricas
| Metrica | Valor | SLA | Status |
|---------|-------|-----|--------|
| Tempo medio de aprovacao | 18h | < 72h | ✅ |
| Taxa de rollback | 0% | < 10% | ✅ |
| Tempo medio de dry-run | 45m | < 4h | ✅ |

## Incidentes Relacionados
- Nenhum incidente relacionado a versionamento

## Recomendacoes
- [ ] Revisar processo de dry-run para reduzir tempo
- [ ] Implementar testes automatizados para versoes MINOR
```

---

#### Relatorio de Auditoria de Versoes
**Frequencia:** Trimestral
**Responsavel:** AO

```markdown
# Relatorio de Auditoria de Versoes - Revenue Share
**Periodo:** Q4 2024

## Versoes Auditadas
| Versao | Status | Aprovacoes | Dry-run | Deploy | Rollback |
|--------|--------|------------|---------|--------|----------|
| 1.0.0 | ARCHIVED | ✅ | ✅ | ✅ | ❌ |
| 1.0.1 | ACTIVE | ✅ | ✅ | ✅ | ❌ |
| 1.1.0 | ACTIVE | ✅ | ✅ | ✅ | ❌ |

## Validacoes
- [x] Hash chain consistente
- [x] Aprovacoes validas
- [x] Dry-run executados
- [x] Deploys auditados
- [x] Rollbacks documentados

## Achados
- Nenhum achado de auditoria

## Recomendacoes
- [ ] Manter processo atual
```

---

## 10. Controle de Versao

| Versao | Data | Autor | Mudancas | Aprovacao |
|--------|------|-------|----------|-----------|
| 1.0.0 | 2024-11-02 | Vibe Code | Criacao inicial | Pendente |

---

## 11. Aprovacoes

| Role | Nome | Assinatura | Data |
|------|------|------------|------|
| Chief Financial Officer | [CFO Name] | __________ | _____ |
| Chief Compliance Officer | [CCO Name] | __________ | _____ |
| Operations Manager | [OM Name] | __________ | _____ |

---

*Este documento e classificado como **Confidencial** e deve ser armazenado com controle de acesso adequado.*
*Qualquer copia ou distribuicao deve ser autorizada pelo CFO ou OM.*
