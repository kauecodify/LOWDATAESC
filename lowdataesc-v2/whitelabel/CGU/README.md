# **Módulo de Rastreabilidade de Decisão e Integridade - CGU (Controladoria-Geral da União)**
**Versão:** 2.0 | **Classificação:** Restrito / Transparência e Combate à Corrupção
**Responsável:** Secretaria de Transparência e Prevenção da Corrupção
**Data de Atualização:** 2024-11-15

---

## **📌 Objetivo Principal do Módulo**

O **Módulo CGU** na LOWDATAESC v2 é o **guardião da integridade e transparência** do sistema. Seu propósito é **rastrear cada decisão, alteração ou autorização** dentro da plataforma, garantindo que:

1. **Nenhuma ação** seja executada sem **autenticação robusta** (MFA + Multi-Sig).
2. **Todas as alterações** sejam **auditáveis** e vinculadas a **pessoas físicas** (CPF, IP, dispositivo).
3. **Regras de compliance** (LAI, LRF, LDO) sejam **automaticamente validadas**.
4. **Qualquer tentativa de fraude ou corrupção** seja **detectada e bloqueada** em tempo real.

Este módulo atua como um **"Notário Digital"**, registrando **quem fez o quê, quando, onde e por quê** em um **ledger imutável** assinado com **Criptografia Pós-Quântica (PQC)**.

---

## **🔍 Mecanismos de Controle Ativados**

### **1. Rastreabilidade de Decisão (Who, What, When, Where, Why)**
- **Tecnologia:** Blockchain Privada (Hyperledger Fabric) + HSM (Hardware Security Module)
- **Funcionamento:**
  - Cada **ação crítica** (ex: alteração de regras, autorização de saque) é registrada com:
    - **CPF do solicitante** (hashado para privacidade).
    - **Timestamp** (precisão de milissegundos).
    - **IP e dispositivo** (fingerprint do hardware).
    - **Justificativa** (campo obrigatório para alterações).
    - **Hash da ação anterior** (encadeamento imutável).
  - **Imutabilidade:** Registros **não podem ser alterados ou deletados**, apenas **anulados** (com justificativa).

### **2. Autenticação Multi-Fator (MFA) + Multi-Sig (Assinatura Múltipla)**
- **Requisitos para Ações Críticas:**
  | **Nível de Ação**               | **MFA Requerido**               | **Multi-Sig Requerido**               | **Exemplo**                          |
  |---------------------------------|----------------------------------|---------------------------------------|--------------------------------------|
  | **Visualização (Read-Only)**    | Biometria + OTP                   | Não                                   | Consultar relatórios                 |
  | **Alteração de Parâmetros**     | Biometria + Hardware Token        | 1 assinatura (APPROVER_L2)            | Ajustar taxa de yield                 |
  | **Alteração de Regras**         | Biometria + Hardware Token        | 2 assinaturas (APPROVER_L3)           | Modificar split CBS/IBS               |
  | **Saque do Escrow (> R$ 1MM)**   | Biometria + Hardware Token + IP   | 3 assinaturas (APPROVER_L4)           | Liberar fundos para Tesouro           |

- **Tecnologia:**
  - **Hardware Token:** YubiKey FIDO2 ou equivalente.
  - **Biometria:** Reconhecimento facial ou digital (padrão ICP-Brasil).
  - **Multi-Sig:** Assinaturas digitais **PQC (Dilithium)** de múltiplos gestores.

### **3. Painel de Integridade Pública (Dashboard CGU)**
- **Visualização:**
  - **Mapa de Decisões:** Todas as alterações em tempo real.
  - **Alertas de Anomalias:** Tentativas de acesso não autorizado, alterações suspeitas.
  - **Rastro de Auditoria:** Link para o **ledger imutável** de cada ação.
  - **Gráficos de Compliance:** % de ações aprovadas/rejeitadas por tipo.
- **Integração:**
  - **API REST** (mTLS + PQC) para o **Sistema de Integridade da CGU**.
  - **Exportação automática** de relatórios em **PDF (assinado digitalmente)**.

### **4. Gatekeeping Automático (Defesa contra Ações Não Autorizadas)**
- **Regras de Bloqueio Automático:**
  - **Acesso fora do horário comercial** (08:00-18:00, dias úteis).
  - **IP não cadastrado** (whitelisting estrito).
  - **Dispositivo não reconhecido** (fingerprint desconhecido).
  - **Tentativas de brute-force** (mais de 3 tentativas falhas).
- **Ação:**
  - **Bloqueio imediato** do usuário/IP/dispositivo.
  - **Notificação** ao **SOC (Security Operations Center)** e **MPF (Ministério Público Federal)**.

### **5. Compliance com Leis e Normas (LAI, LRF, LDO)**
- **Validação Automatizada:**
  - **LAI (Lei de Acesso à Informação):** Garante que **dados públicos** estejam disponíveis.
  - **LRF (Lei de Responsabilidade Fiscal):** Impede **gastos excessivos** ou **descontrole orçamentário**.
  - **LDO (Lei de Diretrizes Orçamentárias):** Assegura que **todas as despesas** estejam alinhadas ao orçamento.
  - **Lei de Improbidade (Lei 8.429/1992):** Detecta **conflitos de interesse** ou **benefício a terceiros**.

---

## **📊 Dados Processados por este Módulo**

| **Tipo de Dado**               | **Fonte**                     | **Frequência**       | **Sensibilidade** | **Tratamento**                     |
|--------------------------------|-------------------------------|----------------------|-------------------|------------------------------------|
| Logs de Acesso                 | Todos os módulos              | Tempo Real           | Restrita          | Hashing + PQC + WORM               |
| Alterações de Regras           | Backend (Engine)              | Event-Driven         | Restrita          | Multi-Sig + Ledger Imutável        |
| Autorizações de Saque          | Escrow                        | Event-Driven         | Restrita          | MFA + Multi-Sig + Log WORM          |
| Relatórios de Compliance       | CGU (Sistema Interno)         | Diário               | Restrita          | Assinatura PQC + Export PDF         |
| Alertas de Anomalias            | SIEM (Splunk)                 | Tempo Real           | Restrita          | Notificação Push + Email            |

---

## **🔐 Requisitos de Segurança e Compliance**

### **1. Requisitos de Acesso**
- **Nível Mínimo:** `AUDITOR_L3` (para visualização) ou `ADMIN_L4` (para configurações).
- **Autenticação:**
  - **MFA (Multi-Factor Authentication)** com **Biometria + Hardware Token + IP Whitelisting**.
  - **Certificado Digital** válido (ICP-Brasil A3).
- **IP Whitelisting:** Apenas IPs **cadastrados na CGU** podem acessar o painel de integridade.

### **2. Requisitos de Infraestrutura**
- **Localização:**
  - **Backend:** Hospedado em **Data Center do Serpro (Brasília)**.
  - **Frontend:** Acessível via **nuvem pública (AWS GovCloud)**, mas **sem acesso ao banco de dados**.
- **Conexão:**
  - **MPLS (Multiprotocol Label Switching)** entre nuvem e on-premise.
  - **Criptografia:** TLS 1.3 + PQC (Kyber + Dilithium).

### **3. Requisitos de Auditoria**
- **Logs Imutáveis:** Todos os acessos e ações são registrados em **WORM Storage**.
- **Retenção:**
  - **Logs de auditoria:** 30 anos (padrão CGU).
  - **Logs de acesso:** 10 anos.
- **Exportação:**
  - Formatos suportados: **PDF (assinado), JSON (API), XML (Padrão CGU)**.
  - **Assinatura Digital:** Todos os relatórios são assinados com **Dilithium (PQC)**.

---

## **🚀 Integrações com Outros Módulos**

| **Módulo**               | **Tipo de Integração**       | **Protocolo**               | **Frequência**       | **Dado Trocado**                          |
|--------------------------|-----------------------------|-----------------------------|----------------------|-----------------------------------------|
| **TCU**                  | API REST (mTLS)              | HTTPS + PQC                 | Tempo Real           | Logs de auditoria e anomalias           |
| **PGE-SP**               | Webhook                      | HTTPS + Assinatura PQC      | Event-Driven         | Alertas de alterações não autorizadas  |
| **ANPD**                 | Stream (Kafka)               | TLS 1.3 + PQC               | Tempo Real           | Dados de compliance LGPD                |
| **COMITÊ GESTOR IBS**    | Batch (SFTP)                 | SSH + Chave PQC             | Diário               | Relatórios de integridade fiscal        |
| **MPF**                  | API REST                     | HTTPS + mTLS                | Event-Driven         | Notificações de violações legais        |

---

## **📈 Métricas de Desempenho (SLA)**

| **Métrica**                          | **Meta**               | **Medição**               | **Responsável**       |
|--------------------------------------|------------------------|---------------------------|-----------------------|
| Latência de Validação de MFA         | < 200ms                | Prometheus + Grafana      | Equipe de Infra      |
| Disponibilidade do Sistema           | 99.99%                 | UptimeRobot               | Equipe de Infra      |
| Taxa de Falsos Positivos (Bloqueios) | < 0.01%                | SIEM (Splunk)             | CGU                  |
| Tempo de Detecção de Fraude          | < 1 segundo            | SIEM + Alertas em Tempo Real | SOC               |
| Tempo de Resolução de Incidentes     | < 5 minutos            | Jira + PagerDuty          | Equipe de Suporte    |

---

## **🛡️ Plano de Contingência (Disaster Recovery)**

### **1. Falha no Ledger de Auditoria**
- **Ação Imediata:**
  - **Failover automático** para o **Ledger de Backup** (replica em outro DC).
  - **Notificação** para o **SOC** e **CGU**.
- **Tempo Máximo de Recuperação (RTO):** 2 minutos.
- **Perda Máxima de Dados (RPO):** 0 (sincronização em tempo real).

### **2. Ataque Cibernético (Ransomware/DDoS)**
- **Ação Imediata:**
  - **Isolamento** do nó afetado.
  - **Ativação do Circuit Breaker** (bloqueio de todas as alterações).
  - **Notificação** ao **CERT.br**, **CGU** e **MPF**.
- **Backup:**
  - **Fitas Magnéticas (WORM)** armazenadas em **cofre físico (Air-Gapped)**.
  - **Teste de Restauração:** Semanal.

### **3. Tentativa de Fraude (Acesso Não Autorizado)**
- **Ação Imediata:**
  - **Bloqueio imediato** do usuário, IP e dispositivo.
  - **Investigação forense** iniciada automaticamente.
  - **Notificação** ao **MPF** e **Polícia Federal**.

---

## **📞 Contatos e Suporte**

| **Tipo**               | **Contato**                          | **Email**                          | **Telefone**       | **Disponibilidade**       |
|------------------------|--------------------------------------|------------------------------------|--------------------|---------------------------|
| **Suporte Técnico**    | Equipe LOWDATAESC                    | suporte@lowdataesc.gov.br          | +55 (61) 9999-9999 | 24/7 (SOC)                |
| **Integridade Pública**| CGU - Controladoria-Geral da União   | integridade@cgu.gov.br             | +55 (61) 3414-5000 | 08:00 - 18:00 (Dias Úteis) |
| **Emergências**        | SOC (Security Operations Center)     | soc@lowdataesc.gov.br              | +55 (61) 9999-0000 | 24/7                      |
| **Denúncias**          | MPF - Ministério Público Federal     | denuncia@mpf.mp.br                 | 0800-644-0000      | 24/7                      |

---

## **📝 Changelog (Histórico de Versões)**

| **Versão** | **Data**       | **Descrição**                                                                 | **Responsável**       |
|------------|----------------|-------------------------------------------------------------------------------|-----------------------|
| 2.0        | 2024-11-15     | **Lançamento da v2:** Rastreabilidade de decisão, Multi-Sig, PQC             | Equipe LOWDATAESC     |
| 1.5        | 2024-08-20     | Adição de autenticação MFA e gatekeeping automático                          | CGU                   |
| 1.0        | 2024-01-10     | Versão inicial com logs de auditoria básicos                                 | CGU                   |

---

## **🔗 Links Úteis**
- [Documentação Técnica Completa (Confluence)](https://lowdataesc.atlassian.net/wiki)
- [API Reference (Swagger)](https://api.lowdataesc.gov.br/docs)
- [Painel de Integridade Pública (CGU)](https://integridade.cgu.gov.br)
- [Repositório Git (Interno)](https://git.serpro.gov.br/lowdataesc/lowdataesc-v2)
- [Lei de Acesso à Informação (LAI)](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12527.htm)
- [Lei de Responsabilidade Fiscal (LRF)](https://www.planalto.gov.br/ccivil_03/leis/lc101.htm)

---

**⚠️ Aviso Legal:**
Este documento é **confidencial** e destina-se **exclusivamente** ao uso interno da **Controladoria-Geral da União (CGU)** e parceiros autorizados. A divulgação não autorizada pode resultar em **sanções administrativas e penais** de acordo com a **Lei de Improbidade Administrativa (Lei 8.429/1992)** e a **Lei de Segurança da Informação (LSI - Lei 13.808/2019)**.

---

**🏛️ Laboratório de Inovação em Transparência e Integridade Pública**
*Desenvolvido em colaboração com a CGU, Serpro e Dataprev.*
*Powered by LOWDATAESC v2.0 | Criptografia Pós-Quântica NIST | Ledger Imutável WORM*
