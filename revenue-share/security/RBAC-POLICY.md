# Poltica de RBAC e Segregao de Funes - Mulo Revenue Share

**Verso:** 1.0.0  
**Data:** 2024-11-02  
**Responsvel:** Arquitetura LOWDATAESC  
**Status:** Aprovado  

---

## 1. Introduo

### 1.1 Propsito
Este documento define a poltica de **Role-Based Access Control (RBAC)** e **Segregao de Funes (SoD - Segregation of Duties)** para o mulo Revenue Share, garantindo que:
- Acesso  concedido com base no princpio do **least privilege**
- Funes crticas so segregadas para prevenir fraudes
- Todas as aes so auditveis

### 1.2 Escopo
Abrange:
- Definio de roles e permisses
- Matriz RACI (Responsible, Accountable, Consulted, Informed)
- Regras de segregao de funes
- Implementao tcnica (OPA, mTLS, JWT)

---

## 2. Princpios

### 2.1 Least Privilege
- Usurios e servios tm apenas as permisses necessrias para suas funes
- Permisses so concedidas explicitamente, nunca por default

### 2.2 Segregao de Funes (SoD)
- **Quem calcula ≠ quem aprova ≠ quem liquida ≠ quem audita**
- Nenhum usurio pode executar todas as etapas de um processo crtico
- Funes crticas so separadas por roles

### 2.3 Separation of Concerns
- Responsabilidades claras para cada role
- Processos bem definidos com checks e balances

### 2.4 Accountability
- Todas as aes so registradas na trilha de auditoria
- Assinaturas digitais para aes crticas

---

## 3. Roles e Permisses

### 3.1 Hierarquia de Roles

```mermaid
graph TD
    A[Super Admin] --> B[Admin]
    B --> C[Compliance Officer]
    B --> D[Financial Controller]
    B --> E[Operations Manager]
    C --> F[Compliance Analyst]
    D --> G[Accountant]
    E --> H[Calculation Operator]
    E --> I[Approval Manager]
    I --> J[Technical Approver]
    I --> K[Business Approver]
    I --> L[Financial Approver]
    E --> M[Liquidity Operator]
    E --> N[Dispute Investigator]
    A --> O[Audit Officer]
```

### 3.2 Definio de Roles

#### 3.2.1 Super Admin
**Descrio:** Acesso total ao sistema, apenas para emergncias.

**Permisses:**
- Gerenciar todos os usurios e roles
- Configurar parmetros do sistema
- Acessar todos os dados (com justificativa e audit)
- Executar operaes de manuteno

**Restries:**
- No pode executar operaes de negcio (clculo, aprovao, liquidao)
- Acesso  monitorado e auditado
- Requer MFA + aprovao de pelo menos 2 pessoas

**Usurios:** 2 (mximo)

---

#### 3.2.2 Admin
**Descrio:** Administrao do sistema e gerenciamento de usurios.

**Permisses:**
- Gerenciar usurios (criar, atualizar, desativar)
- Gerenciar roles e permisses
- Configurar limites e quotas
- Monitorar sistema

**Restries:**
- No pode executar operaes de negcio
- No pode acessar dados sensveis sem justificativa

**Usurios:** 3-5

---

#### 3.2.3 Compliance Officer
**Descrio:** Responsvel por conformidade regulatria e auditoria.

**Permisses:**
- Aprovar matrizes de distribuio
- Aprovar clculos (nvel compliance)
- Acessar todos os dados para auditoria
- Gerar relatrios de conformidade
- Investigar disputas
- Bloquear operaes suspeitas

**Restries:**
- No pode criar ou modificar clculos
- No pode executar liquidaes
- No pode alterar dados de eventos

**Usurios:** 2-3

---

#### 3.2.4 Financial Controller
**Descrio:** Responsvel por controles financeiros e contbeis.

**Permisses:**
- Aprovar clculos (nvel financeiro)
- Gerenciar reservas e provises
- Acessar dados financeiros
- Gerar relatrios contbeis
- Configurar regra de arredondamento e redistribuio

**Restries:**
- No pode criar clculos
- No pode aprovar em outros nveis
- No pode executar liquidaes

**Usurios:** 2-3

---

#### 3.2.5 Operations Manager
**Descrio:** Gerencia operaes do mulo.

**Permisses:**
- Gerenciar Calculation Operators
- Gerenciar Liquidity Operators
- Gerenciar Dispute Investigators
- Monitorar performance
- Configurar alertas

**Restries:**
- No pode executar operaes diretamente
- No pode aprovar clculos

**Usurios:** 2-3

---

#### 3.2.6 Calculation Operator
**Descrio:** Executa clculos de distribuio.

**Permisses:**
- Criar clculos
- Editar clculos em DRAFT
- Submeter clculos para aprovao
- Visualizar eventos de receita
- Visualizar matrizes de distribuio

**Restries:**
- No pode aprovar clculos
- No pode executar liquidaes
- No pode modificar eventos

**Usurios:** 5-10

---

#### 3.2.7 Approval Manager
**Descrio:** Gerencia o processo de aprovao.

**Permisses:**
- Visualizar clculos em aprovao
- Escalar clculos atrasados
- Monitorar SLA de aprovao

**Restries:**
- No pode aprovar ou rejeitar clculos
- No pode modificar clculos

**Usurios:** 2-3

---

#### 3.2.8 Technical Approver
**Descrio:** Aprova clculos do ponto de vista tcnico.

**Permisses:**
- Aprovar/rejeitar clculos (nvel tcnico)
- Visualizar detalhes do clculo
- Adicionar comentrios tcnicos

**Restries:**
- No pode criar clculos
- No pode aprovar em outros nveis
- No pode executar liquidaes

**Usurios:** 3-5

---

#### 3.2.9 Business Approver
**Descrio:** Aprova clculos do ponto de vista comercial.

**Permisses:**
- Aprovar/rejeitar clculos (nvel comercial)
- Visualizar detalhes do clculo
- Adicionar comentrios comerciais

**Restries:**
- No pode criar clculos
- No pode aprovar em outros nveis
- No pode executar liquidaes

**Usurios:** 3-5

---

#### 3.2.10 Financial Approver
**Descrio:** Aprova clculos do ponto de vista financeiro.

**Permisses:**
- Aprovar/rejeitar clculos (nvel financeiro)
- Visualizar detalhes do clculo
- Adicionar comentrios financeiros

**Restries:**
- No pode criar clculos
- No pode aprovar em outros nveis
- No pode executar liquidaes

**Usurios:** 2-3

---

#### 3.2.11 Liquidity Operator
**Descrio:** Executa instrues de liquidao.

**Permisses:**
- Gerar instrues de liquidao
- Enviar instrues para LOWDATAESC
- Monitorar status de liquidaes
- Gerar relatrios de liquidao

**Restries:**
- No pode criar clculos
- No pode aprovar clculos
- No pode modificar instrues j enviadas

**Usurios:** 3-5

---

#### 3.2.12 Dispute Investigator
**Descrio:** Investiga disputas.

**Permisses:**
- Visualizar disputas
- Adicionar anotaes de investigao
- Resolver disputas
- Solicitar reclculos

**Restries:**
- No pode criar clculos
- No pode aprovar clculos
- No pode executar liquidaes

**Usurios:** 3-5

---

#### 3.2.13 Compliance Analyst
**Descrio:** Analista de conformidade.

**Permisses:**
- Visualizar dados para anlise
- Gerar relatrios de conformidade
- Monitorar auditoria

**Restries:**
- No pode modificar dados
- No pode aprovar

**Usurios:** 3-5

---

#### 3.2.14 Accountant
**Descrio:** Contador.

**Permisses:**
- Visualizar dados financeiros
- Gerar relatrios contbeis
- Configurar reservas

**Restries:**
- No pode modificar dados
- No pode aprovar

**Usurios:** 3-5

---

#### 3.2.15 Audit Officer
**Descrio:** Auditor independente.

**Permisses:**
- Acessar todos os dados (somente leitura)
- Gerar relatrios de auditoria
- Verificar hash chain

**Restries:**
- No pode modificar dados
- No pode executar operaes

**Usurios:** 2-3

---

### 3.3 Matriz de Permisses por Recurso

| Recurso | Calculation Operator | Technical Approver | Business Approver | Financial Approver | Compliance Officer | Liquidity Operator | Dispute Investigator | Audit Officer |
|---------|---------------------|-------------------|------------------|--------------------|-------------------|-------------------|---------------------|---------------|
| **Eventos** | R, L | R, L | R, L | R, L | R, L | R, L | R, L | R, L |
| Criar | - | - | - | - | - | - | - | - |
| Modificar | - | - | - | - | - | - | - | - |
| **Clculos** | R, L, C, U | R, L, A | R, L, A | R, L, A | R, L, A | R, L | R, L | R, L |
| Criar | C | - | - | - | - | - | - | - |
| Submeter | C | - | - | - | - | - | - | - |
| Aprovar (Tcnico) | - | A | - | - | - | - | - | - |
| Aprovar (Negcio) | - | - | A | - | - | - | - | - |
| Aprovar (Financeiro) | - | - | - | A | - | - | - | - |
| Aprovar (Compliance) | - | - | - | - | A | - | - | - |
| **Instrues** | - | - | - | - | - | R, L, C | R, L | R, L |
| Gerar | - | - | - | - | - | C | - | - |
| Enviar | - | - | - | - | - | C | - | - |
| **Matrizes** | R, L | R, L | R, L | R, L | R, L, C, U | R, L | R, L | R, L |
| Criar | - | - | - | - | C | - | - | - |
| Modificar | - | - | - | - | C | - | - | - |
| **Reconciliao** | R, L | R, L | R, L | R, L | R, L, C | R, L | R, L | R, L |
| Executar | - | - | - | - | C | - | - | - |
| **Disputas** | - | - | - | - | R, L, U | - | R, L, U | R, L |
| Resolver | - | - | - | - | U | - | U | - |
| **Participantes** | R, L | R, L | R, L | R, L | R, L, U | R, L | R, L | R, L |
| Modificar | - | - | - | - | U | - | - | - |

**Legenda:**
- R: Read (Ler)
- L: List (Listar)
- C: Create (Criar)
- U: Update (Atualizar)
- D: Delete (Deletar)
- A: Approve (Aprovar)
- -: No permitido

---

## 4. Matriz RACI

### 4.1 Ingesto de Eventos

| Atividade | Calculation Operator | Technical Approver | Operations Manager | Compliance Officer | Audit Officer |
|-----------|---------------------|-------------------|-------------------|-------------------|---------------|
| Receber evento | A | C | C | C | I |
| Validar evento | R | C | C | C | I |
| Normalizar evento | R | - | - | - | I |
| Armazenar evento | R | - | - | - | I |

---

### 4.2 Clculo de Distribuio

| Atividade | Calculation Operator | Technical Approver | Business Approver | Financial Approver | Compliance Officer | Operations Manager | Audit Officer |
|-----------|---------------------|-------------------|------------------|--------------------|-------------------|-------------------|---------------|
| Criar clculo | R | C | C | C | C | C | I |
| Validar clculo | R | R | - | - | C | - | I |
| Aprovar (Tcnico) | - | R | - | - | - | - | I |
| Aprovar (Negcio) | - | - | R | - | - | - | I |
| Aprovar (Financeiro) | - | - | - | R | - | - | I |
| Aprovar (Compliance) | - | - | - | - | R | - | I |

---

### 4.3 Liquidao

| Atividade | Liquidity Operator | Technical Approver | Compliance Officer | Operations Manager | Audit Officer |
|-----------|-------------------|-------------------|-------------------|-------------------|---------------|
| Gerar instruo | R | C | C | C | I |
| Enviar instruo | R | - | C | C | I |
| Confirmar liquidao | R | - | C | - | I |

---

### 4.4 Reconciliao

| Atividade | Financial Controller | Compliance Officer | Accountant | Operations Manager | Audit Officer |
|-----------|----------------------|-------------------|-----------|-------------------|---------------|
| Executar reconciliao | R | C | R | C | I |
| Analisar divergncias | R | R | R | C | I |
| Resolver divergncias | R | R | R | - | I |

---

### 4.5 Gerenciamento de Disputas

| Atividade | Dispute Investigator | Compliance Officer | Operations Manager | Audit Officer |
|-----------|---------------------|-------------------|-------------------|---------------|
| Abrir disputa | I | I | I | I |
| Investigar disputa | R | C | C | I |
| Resolver disputa | R | R | C | I |

---

### 4.6 Matriz de Distribuio

| Atividade | Compliance Officer | Financial Controller | Operations Manager | Audit Officer |
|-----------|-------------------|----------------------|-------------------|---------------|
| Criar matriz | R | C | C | I |
| Aprovar matriz | R | R | C | I |
| Ativar matriz | R | - | C | I |

---

## 5. Regras de Segregao de Funes

### 5.1 Regras Principais

1. **Clculo vs Aprovao:**
   - Um usurio que **cria clculos** no pode **aprovar clculos**
   - Um usurio que **aprova clculos** no pode **criar clculos**

2. **Aprovao Multi-Nvel:**
   - Cada nvel de aprovao deve ser executado por um usurio diferente
   - Um usurio no pode aprovar em mltiplos nveis

3. **Aprovao vs Liquidao:**
   - Um usurio que **aprova clculos** no pode **executar liquidaes**
   - Um usurio que **executa liquidaes** no pode **aprovar clculos**

4. **Operao vs Auditoria:**
   - Um usurio que **executa operaes** no pode **auditar**
   - O **Audit Officer** no pode executar operaes de negcio

5. **Criao vs Modificao:**
   - Um usurio que **cria um evento** no pode **modific-lo** aps a ingesto
   - Um usurio que **cria um clculo** no pode **modific-lo** aps submeter para aprovao

---

### 5.2 Verificao Automtica

O sistema deve verificar automaticamente:
1. **Segregao de Funes:** Antes de permitir uma ao, verificar que o usurio no violou as regras de SoD
2. **Conflito de Interesses:** Verificar se o usurio tem interesse no resultado da operao
3. **Histrico de Aes:** Verificar se o usurio j executou aes conflituosas recentemente

---

## 6. Implementao Tcnica

### 6.1 OPA (Open Policy Agent)

**Polticas de Acesso:**

```rego
# Permitir leitura de eventos para todos os usurios autenticados
allow_read_event {
    input.method == "GET"
    input.path == ["revenue-events", event_id]
    input.user.authenticated
}

# Permitir criao de eventos apenas para Calculation Operators
allow_create_event {
    input.method == "POST"
    input.path == ["revenue-events"]
    input.user.role == "calculation_operator"
}

# Permitir criao de clculos apenas para Calculation Operators
allow_create_calculation {
    input.method == "POST"
    input.path == ["calculations"]
    input.user.role == "calculation_operator"
}

# Permitir aprovao tcnica apenas para Technical Approvers
allow_approve_technical {
    input.method == "POST"
    input.path == ["calculations", calculation_id, "approve"]
    input.body.approval_level == "technical"
    input.user.role == "technical_approver"
    # Verificar que o usurio no criou o clculo
    not user_created_calculation(input.user.id, calculation_id)
}

# Verificar segregao de funes
user_created_calculation(user_id, calculation_id) {
    calculation := data.calculations[_]
    calculation.calculation_id == calculation_id
    calculation.created_by == user_id
}

# Permitir liquidao apenas para Liquidity Operators
allow_create_settlement {
    input.method == "POST"
    input.path == ["settlement-instructions"]
    input.user.role == "liquidity_operator"
    # Verificar que o clculo est aprovado
    calculation := data.calculations[_]
    calculation.calculation_id == input.body.calculation_id
    calculation.status == "approved"
}
```

---

### 6.2 mTLS e JWT

**Autenticao entre Servios:**
- Todos os servios internos usam **mTLS** com SPIFFE/SPIRE
- Certificados so emitidos e gerenciados automaticamente
- Validao de certificado  obrigatria

**Autenticao de Usurios:**
- APIs externas usam **JWT** com OPA para autorizao
- JWT contm claims de role e permisses
- Assinatura digital com RSA-2048 ou ECDSA

---

### 6.3 Service Mesh

**Istio ou Linkerd:**
- Gerenciamento de mTLS
- Controle de trfego
- Observabilidade
- Polticas de segurana

---

## 7. Auditoria

### 7.1 Trilha de Auditoria
Todas as aes de segurana devem ser registradas:
- Autenticao (sucesso/falha)
- Autorizao (permitido/negado)
- Mudanas de role
- Tentativas de violao de SoD

### 7.2 Alertas
- Tentativas repetidas de acesso negado
- Violaes de SoD
- Mudanas no autorizadas de role
- Acessos fora do horrio comercial

---

## 8. Critrios de Aceite

- [ ] Todos os roles definidos e documentados
- [ ] Matriz RACI completa e validada
- [ ] Regras de SoD implementadas no OPA
- [ ] Testes de SoD executados (tentativas de violao bloqueadas)
- [ ] Trilha de auditoria completa
- [ ] Alertas de segurana configurados
- [ ] Documentao de RBAC e SoD aprovada

---

## 9. Anexos

- [Threat Model](./THREAT-MODEL.md)
- [Especificao de Autenticao e Autorizao](AUTH-SPEC.md)
- [Matriz RACI Detalhada](../governance/RACI-MATRIX.md)

---

**Aprovado por:** _________________________  
**Data:** _______________  
**Verso:** 1.0.0
