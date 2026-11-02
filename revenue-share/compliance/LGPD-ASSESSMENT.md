# Avaliao LGPD - Mulo Revenue Share

**Verso:** 1.0.0  
**Data:** 2024-11-02  
**Responsvel:** Arquitetura LOWDATAESC  
**Status:** Aprovado  

---

## 1. Introduo

### 1.1 Propsito
Este documento avalia a conformidade do mulo Revenue Share com a **Lei Geral de Proteo de Dados Pessoais (LGPD - Lei 13.709/2018)**, identificando:
- Dados pessoais processados
- Base legal para cada processamento
- Medidas de segurana implementadas
- Riscos e mitigaes
- Aes de conformidade

### 1.2 Escopo
Abrange todos os dados pessoais processados pelo mulo Revenue Share, incluindo:
- Dados de participantes (fundadores, investidores, operaes)
- Dados de usurios do sistema
- Dados de eventos de receita (quando contiverem dados pessoais)
- Dados de auditoria

### 1.3 Base Legal
- **LGPD:** Lei 13.709/2018
- **Regulamentao:** Decreto 10.474/2020
- **ANPD:** Autoridade Nacional de Proteo de Dados

---

## 2. Classificao de Dados

### 2.1 Dados Pessoais Processados

| Categoria | Tipo | Sensvel? | Exemplo | Base Legal | Reteno |
|-----------|------|-------------|---------|------------|-----------|
| **Participantes** | Nome | No | Fundador A | Contrato | 7 anos |
| | CPF/CNPJ | Sim | 123.456.789-00 | Contrato | 7 anos |
| | E-mail | No | contato@participante.com | Contrato | 7 anos |
| | Telefone | No | +55 11 1234-5678 | Contrato | 7 anos |
| | Endereo | No | Av. Paulista, 1234 | Contrato | 7 anos |
| | Dados bancrios | Sim | Conta corrente | Contrato | 7 anos |
| **Usurios** | Nome | No | Usurio A | Consentimento | 7 anos |
| | E-mail | No | usuario@lowdataesc.com | Consentimento | 7 anos |
| | CPF | Sim | 123.456.789-00 | Consentimento | 7 anos |
| | Device Fingerprint | No | Hash do dispositivo | Legtimo interesse | 7 anos |
| | IP Address | No | 192.168.1.1 | Legtimo interesse | 1 ano |
| **Eventos** | Dados do pagador | Sim | Nome do cliente | Consentimento | 7 anos |
| | Dados do beneficirio | Sim | Nome do beneficirio | Contrato | 7 anos |

### 2.2 Dados Sensveis
Dados que requerem proteo especial:
- CPF/CNPJ
- Dados bancrios
- Dados de pagadores/beneficirios (quando identificveis)

---

## 3. Base Legal por Processamento

### 3.1 Consentimento (Art. 7o, I)
**Aplicabilidade:** Dados de usurios e participantes no essenciais para a operao.

**Processamentos:**
- Cadastro de usurios do sistema
- Dados de participantes (quando no cobertos por contrato)
- Dados de pagadores em eventos de receita

**Requisitos:**
- Consentimento livre, informado e inequvoc
- Possibilidade de revogao
- Registro do consentimento
- Informao clara sobre finalidade

---

### 3.2 Contrato (Art. 7o, V)
**Aplicabilidade:** Dados necessrios para execuo de contrato.

**Processamentos:**
- Dados de participantes para distribuio de receita
- Dados de operaes para integrao
- Dados de beneficirios para liquidao

**Requisitos:**
- Contrato vlido entre as partes
- Dados estritamente necessrios para execuo
- Informao sobre processamento

---

### 3.3 Legtimo Interesse (Art. 7o, IX)
**Aplicabilidade:** Dados necessrios para segurana e fraude.

**Processamentos:**
- Device fingerprint
- IP address (para segurana)
- Logs de auditoria
- Dados de autenticao

**Requisitos:**
- Proporcionalidade
- Minimizao
- Transparncia

---

### 3.4 Cumprimento de Obrigao Legal (Art. 7o, II)
**Aplicabilidade:** Dados necessrios para conformidade regulatria.

**Processamentos:**
- Dados para auditoria (BCB, CVM, SUSEP)
- Dados para fiscalizao
- Dados para investigao de fraudes

**Requisitos:**
- Base legal clara
- Minimizao de dados
- Reteno conforme regulamentao

---

## 4. Processamento de Dados

### 4.1 Finalidades

| Finalidade | Dados Processados | Base Legal | Reteno |
|------------|-------------------|------------|-----------|
| Distribuio de receita | Participantes, matriz, eventos | Contrato | 7 anos |
| Liquidao financeira | Participantes, instrues | Contrato | 7 anos |
| Auditoria | Todos os dados | Obrigao legal | 7 anos |
| Segurana | Logs, device fingerprint | Legtimo interesse | 1-7 anos |
| Conformidade | Relatrios, dados regulatrios | Obrigao legal | 7 anos |
| Disputas | Participantes, clculos | Contrato | 7 anos |

---

### 4.2 Fluxo de Dados

```mermaid
graph TD
    A[Participante] -->|Consentimento/Contrato| B[LOWDATAESC]
    C[Operao] -->|Eventos de Receita| B
    D[Pagador] -->|Dados de Pagamento| B
    
    B -->|Armazenamento| E[Banco de Dados\nPostgreSQL]
    B -->|Armazenamento Imutvel| F[S3 WORM]
    B -->|Processamento| G[Servios\nRevenue Share]
    G -->|Liquidao| H[LOWDATAESC\nSettlement]
    
    %% Dados Sensveis
    E -.-|Criptografia| I[KMS\nAES-256]
    F -.-|Criptografia| I
    
    %% Controles
    B -->|Autenticao| J[mTLS + JWT]
    B -->|Autorizao| K[RBAC + OPA]
    B -->|Auditoria| L[Audit Trail\nHash Chain]
```

---

### 4.3 Minimizao de Dados

**Princpio:** Coletar apenas dados estritamente necessrios.

**Medidas:**
- **Anonimizao:** Dados de pagadores so anonimizados quando possvel
- **Pseudonimizao:** Identificadores nicos para participantes
- **Tokenizao:** Dados sensveis so tokenizados
- **Excluso:** Dados no necessrios so excludos aps uso

---

## 5. Medidas de Segurana

### 5.1 Criptografia
- **Em Trnsito:** TLS 1.3 para todas as comunicaes
- **Em Repouso:** AES-256 (KMS) para dados sensveis
- **Chaves:** HSM ou KMS com rotao automtica

### 5.2 Controle de Acesso
- **RBAC:** Roles com permisses mnimas
- **ABAC:** Controle baseado em atributos
- **OPA:** Polticas de acesso centralizadas
- **MFA:** Autenticao multi-fator

### 5.3 Auditoria
- **Trilha de Auditoria:** Imutvel (S3 WORM + hash chain)
- **Logging:** Todos os acessos a dados pessoais
- **Monitoramento:** SIEM para deteco de anomalias

### 5.4 DLP (Data Loss Prevention)
- **Monitoramento:** Trfego de dados sensveis
- **Bloqueio:** Transferncia no autorizada
- **Classificao:** Dados por nvel de sensibilidade

---

## 6. Direitos dos Titulares

### 6.1 Direito de Acesso (Art. 18, I)
**Processo:**
1. Solicitao via canal oficial (e-mail, portal)
2. Verificao de identidade
3. Fornecimento de dados em formato estruturado
4. Prazo: 15 dias

**Implementao:**
- API de DSR (Data Subject Request)
- Portal do titular
- Processo manual para casos complexos

---

### 6.2 Direito de Retificao (Art. 18, II)
**Processo:**
1. Solicitao de correo
2. Verificao de identidade
3. Atualizao dos dados
4. Notificao de terceiros (se aplicvel)
5. Prazo: 15 dias

---

### 6.3 Direito de Excluso (Art. 18, III)
**Processo:**
1. Solicitao de excluso
2. Verificao de identidade
3. Avaliao de excees (contrato, legal, etc.)
4. Excluso ou anonimizao
5. Prazo: 15 dias

**Excees:**
- Dados necessrios para cumprimento de contrato
- Dados necessrios para conformidade legal
- Dados necessrios para exerccio regular de direitos

---

### 6.4 Direito de Portabilidade (Art. 18, IV)
**Processo:**
1. Solicitao de portabilidade
2. Verificao de identidade
3. Fornecimento de dados em formato estruturado
4. Prazo: 7 dias (formato digital)

---

### 6.5 Direito de Oposio (Art. 18, V)
**Processo:**
1. Solicitao de oposio
2. Avaliao de base legal
3. Interrupo do processamento (se aplicvel)
4. Prazo: 15 dias

---

### 6.6 Direito de Revogao do Consentimento (Art. 8o,  5o)
**Processo:**
1. Solicitao de revogao
2. Confirmao da revogao
3. Interrupo do processamento baseados em consentimento
4. Prazo: Imediato

---

## 7. RIPD (Relatrio de Impacto de Proteo de Dados)

### 7.1 Avaliao de Risco

| Processamento | Risco | Medidas de Mitigao | Residual |
|---------------|-------|---------------------------|----------|
| Armazenamento de CPF | Alto | Criptografia + RBAC | Mdio |
| Processamento de dados bancrios | Alto | Tokenizao + HSM | Mdio |
| Logs com IP address | Mdio | Anonimizao aps 1 ano | Baixo |
| Transferncia internacional | Alto | SCC + BCR | Mdio |
| Auditoria com dados pessoais | Mdio | Minimizao + criptografia | Baixo |

### 7.2 Medidas de Mitigao

1. **Criptografia:** AES-256 para dados sensveis
2. **Pseudonimizao:** Identificadores nicos para participantes
3. **Minimizao:** Coletar apenas dados necessrios
4. **Controle de Acesso:** RBAC + OPA
5. **Auditoria:** Trilha imutvel
6. **DLP:** Preveno de vazamento
7. **Treinamento:** Conscientizao de colaboradores

---

## 8. Transferncia Internacional de Dados

### 8.1 Jurisdies Envolvidas
- **Brasil:** LOWDATAESC (controladora)
- **EUA:** AWS (processadora)
- **UE:** Possveis operaes internacionais

### 8.2 Mecanismos de Transferncia
- **SCCs (Standard Contractual Clauses):** Contratos padro da Comisso Europeia
- **BCRs (Binding Corporate Rules):** Regras corporativas vinculantes (futuro)
- **Adequacy Decisions:** Decises de adequao (quando aplicvel)

### 8.3 Controles
- **AWS:** DPA (Data Processing Addendum) assinado
- **Criptografia:** Dados criptografados em trnsito e repouso
- **Auditoria:** Direito de auditoria sobre processadores
- **Notificao:** Notificao de violaes de segurana

---

## 9. Violao de Dados

### 9.1 Processo de Notificao

**Prazos:**
- **ANPD:** 2 dias teis (aps confirmao)
- **Titular:** Imediato (se alto risco)

**Processo:**
1. Deteco da violao
2. Investigao interna
3. Confirmao da violao
4. Notificao   ANPD
5. Notificao aos titulares (se aplicvel)
6. Medidas de mitigao

### 9.2 Registro de Violaes
- **Obrigatoriedade:** Todas as violaes devem ser registradas
- **Contedo:** Data, tipo, dados afetados, medidas tomadas
- **Reteno:** 5 anos

---

## 10. Governana

### 10.1 Encarregado de Dados (DPO)
**Responsabilidades:**
- Supervisionar conformidade LGPD
- Orientar sobre proteo de dados
- Receber solicitaes de titulares
- Cooperar com ANPD

**Contato:**
- Nome: [Nome do DPO]
- E-mail: dpo@lowdataesc.com
- Telefone: [Telefone]

### 10.2 Comit de Proteo de Dados
**Membros:**
- DPO
- Diretor Jurdico
- Diretor de Segurana
- Diretor de Operações

**Reunies:** Trimestrais

---

## 11. Treinamento e Conscientizao

### 11.1 Treinamentos
- **Frequncia:** Anual
- **Pblico:** Todos os colaboradores
- **Contedo:** LGPD, segurana de dados, procedimentos

### 11.2 Conscientizao
- **Campanhas:** Periódicas
- **Materiais:** Guia de boas práticas, FAQ
- **Testes:** Simulações de violações

---

## 12. Auditoria e Conformidade

### 12.1 Auditoria Interna
- **Frequência:** Anual
- **Escopo:** Todos os processos de dados pessoais
- **Metodologia:** Checklist de conformidade LGPD

### 12.2 Auditoria Externa
- **Frequência:** Bienal
- **Escopo:** Avaliação independent de conformidade
- **Certificação:** Possível selo de conformidade

### 12.3 Autoavaliação
- **Frequência:** Trimestral
- **Ferramenta:** Questionário de conformidade
- **Ação:** Plano de melhorias

---

## 13. Critérios de Aceite

- [ ] Avaliação LGPD completa
- [ ] Base legal definida para todos os processamentos
- [ ] Medidas de segurança implementadas
- [ ] Processos de DSR (Data Subject Request) funcionais
- [ ] RIPD elaborado e aprovado
- [ ] DPO designado
- [ ] Treinamentos realizados
- [ ] Auditoria de conformidade executada

---

## 14. Anexos

- [Política de Privacidade](../legal/PRIVACY-POLICY.md)
- [Termos de Uso](../legal/TERMS-OF-USE.md)
- [DPA (Data Processing Addendum)](DPA.md)
- [SCCs (Standard Contractual Clauses)](SCCS.md)
- [Registro de Processamento de Dados](DATA-PROCESSING-REGISTER.md)

---

**Aprovado por:** _________________________  
**Data:** _______________  
**Versão:** 1.0.0
