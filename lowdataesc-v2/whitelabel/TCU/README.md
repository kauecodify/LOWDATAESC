# **Módulo de Auditoria Fiscal e Invariantes - TCU (Tribunal de Contas da União)**
**Versão:** 2.0 | **Classificação:** Restrito / Auditoria Governamental
**Responsável:** SEFTI (Secretaria de Fiscalização de Tecnologia da Informação)
**Data de Atualização:** 2024-11-15

---

## **📌 Objetivo Principal do Módulo**

O **Módulo TCU** na LOWDATAESC v2 é o **coração da validação fiscal** para a Reforma Tributária (CBS/IBS, CBA). Seu propósito é **garantir a integridade matemática e a imutabilidade** de todas as transações que envolvem **divisão de receitas federativas**, repasses entre entes públicos e a **conciliação automática** entre o que foi arrecadado e o que foi distribuído.

Este módulo atua como um **"Juiz Fiscal Digital"**, aplicando **regras imutáveis de compliance** antes que qualquer operação seja executada no **Subledger Imutável** da plataforma.

---

## **🔍 Mecanismos de Controle Ativados**

### **1. Subledger Imutável com Hashing Encadeado (WORM - Write Once, Read Many)**
- **Tecnologia:** SHA-256 + CRYSTALS-Dilithium (PQC) para assinaturas
- **Funcionamento:**
  - Cada transação gera um **hash único** que inclui:
    - `tx_id` (ID da transação)
    - `Valor_CBS` (Contribuição sobre Bens e Serviços)
    - `Valor_IBS` (Imposto sobre Bens e Serviços)
    - `Valor_Retido` (Valores retidos na fonte)
    - `Valor_Total_Transacao`
    - `Timestamp` (com precisão de milissegundos)
    - `hash_anterior` (hash da transação anterior)
  - **Imutabilidade:** Uma vez gravado, o registro **não pode ser alterado ou deletado**, apenas **anulado** (com justificativa auditável).

### **2. Validação de Invariantes Fiscais (CBS + IBS + Retidos = Total)**
- **Regra Matemática:**
  ```
  Valor_CBS + Valor_IBS + Valor_Retido == Valor_Total_Transacao (Tolerância: 0.00)
  ```
- **Tolerância:** **Zero absoluto** (qualquer diferença, mesmo de R$ 0,01, é considerada **anomalia crítica**).
- **Ação em Caso de Falha:**
  - Transação **bloqueada no escrow** (conta de garantia).
  - Evento `ANOMALIA_SPLIT` gerado e enviado ao **Painel do Auditor do TCU**.
  - Notificação **push + email** para os responsáveis.

### **3. Validação Temporal (Janela Fiscal)**
- **Contexto:** Cada dia fiscal tem uma **janela de processamento** (ex: 00:00:00 às 23:59:59 UTC-3).
- **Regra:**
  - O `timestamp` da transação **deve estar dentro da janela vigente**.
  - Transações **retroativas** ou **futuras** são **automaticamente rejeitadas**.

### **4. Assinatura Digital Pós-Quântica (PQC)**
- **Padrão:** CRYSTALS-Dilithium (NIST PQC Standard)
- **Funcionamento:**
  - Cada nó originador (ex: Receita Federal, Secretarias Estaduais) **deve assinar digitalmente** a transação.
  - A assinatura é **validada pelo HSM (Hardware Security Module)** antes da execução.
  - **Benefício:** Proteção contra **ataques quânticos futuros** (Harvest Now, Decrypt Later).

### **5. Painel de Auditoria em Tempo Real (SEFTI Dashboard)**
- **Visualização:**
  - **Mapa de Calor** de transações validadas/rejeitadas.
  - **Gráficos de Anomalias** por tipo (Split, Assinatura, Temporal).
  - **Rastro Completo** de cada transação (do originador ao destino final).
- **Integração:**
  - API REST **segura** (mTLS + PQC) para o **Sistema de Auditoria do TCU (SISCOAF)**.
  - Exportação **automática** de relatórios em formato **XML (Padrão TCU)**.

---

## **📊 Dados Processados por este Módulo**

| **Tipo de Dado**               | **Fonte**                     | **Frequência**       | **Sensibilidade** | **Tratamento**                     |
|--------------------------------|-------------------------------|----------------------|-------------------|------------------------------------|
| Transações CBS/IBS             | Receita Federal / Estaduais  | Tempo Real           | Alta              | Hashing + PQC + Subledger Imutável |
| Repasses Federativos           | Tesouro Nacional              | Diário               | Alta              | Validação de Invariantes           |
| Notificações de Anomalias      | Motores de Decisão            | Event-Driven         | Média             | Log Auditável + Assinatura PQC     |
| Relatórios de Compliance       | SISCOAF / SEFTI               | Semanal              | Restrita          | Criptografia Híbrida (AES-256 + PQC) |

---

## **🔐 Requisitos de Segurança e Compliance**

### **1. Requisitos de Acesso**
- **Nível Mínimo:** `AUDITOR_L2` (para visualização) ou `AUDITOR_L3` (para ações corretivas).
- **Autenticação:**
  - **MFA (Multi-Factor Authentication)** com **Biometria + Hardware Token (YubiKey/FIDO2)**.
  - **Certificado Digital** válido (ICP-Brasil A3).
- **IP Whitelisting:** Apenas IPs **cadastrados no TCU** podem acessar o painel de auditoria.

### **2. Requisitos de Infraestrutura**
- **Localização:**
  - **Backend:** Hospedado em **Data Center do Serpro/Dataprev** (território nacional).
  - **Frontend:** Pode ser acessado via **nuvem pública (AWS/Azure)**, mas **sem acesso direto ao banco de dados**.
- **Conexão:**
  - **MPLS (Multiprotocol Label Switching)** ou **Link Dedicado** entre nuvem e on-premise.
  - **Nunca** trafega dados sensíveis pela **Internet pública**.

### **3. Requisitos de Auditoria**
- **Logs Imutáveis:** Todos os acessos e ações são registrados em **WORM Storage (Write Once, Read Many)**.
- **Retenção:**
  - **Logs de transações:** 10 anos (padrão TCU).
  - **Logs de acesso:** 5 anos.
- **Exportação:**
  - Formatos suportados: **XML (Padrão TCU), JSON (API), CSV (Relatórios)**.
  - **Assinatura Digital:** Todos os relatórios são assinados com **Dilithium (PQC)**.

---

## **🚀 Integrações com Outros Módulos**

| **Módulo**               | **Tipo de Integração**       | **Protocolo**               | **Frequência**       | **Dado Troca**                          |
|--------------------------|-----------------------------|-----------------------------|----------------------|-----------------------------------------|
| **COMITÊ GESTOR IBS**    | API REST (mTLS)              | HTTPS + PQC                 | Tempo Real           | Valores de CBS/IBS validados            |
| **PGE-SP**               | Webhook                      | HTTPS + Assinatura PQC      | Event-Driven         | Notificações de anomalias               |
| **CGU**                  | API REST                     | HTTPS + mTLS                | Diário               | Relatórios de integridade               |
| **ANPD**                 | Stream (Kafka)               | TLS 1.3 + PQC               | Tempo Real           | Dados anonimizados (após validação)     |
| **SERPRO**               | Batch (SFTP)                 | SSH + Chave PQC             | Diário (02:00 UTC-3) | Dados de arrecadação consolidados       |

---

## **📈 Métricas de Desempenho (SLA)**

| **Métrica**                          | **Meta**               | **Medição**               | **Responsável**       |
|--------------------------------------|------------------------|---------------------------|-----------------------|
| Latência de Validação                | < 50ms                 | Prometheus + Grafana      | Equipe de Infra      |
| Disponibilidade do Sistema           | 99.95%                 | UptimeRobot               | Equipe de Infra      |
| Taxa de Falsos Positivos (Anomalias) | < 0.1%                 | SIEM (Splunk)             | SEFTI                 |
| Tempo de Detecção de Anomalia        | < 1 segundo            | SIEM + Alertas em Tempo Real | SEFTI             |
| Tempo de Resolução de Incidentes     | < 15 minutos           | Jira + PagerDuty          | Equipe de Suporte    |

---

## **🛡️ Plano de Contingência (Disaster Recovery)**

### **1. Falha no Subledger Principal**
- **Ação Imediata:**
  - **Failover automático** para o **Subledger Secundário** (replica em outro DC).
  - **Notificação** para o **SOC (Security Operations Center)**.
- **Tempo Máximo de Recuperação (RTO):** 5 minutos.
- **Perda Máxima de Dados (RPO):** 0 (sincronização em tempo real).

### **2. Ataque Cibernético (Ransomware/DDoS)**
- **Ação Imediata:**
  - **Isolamento** do nó afetado.
  - **Ativação do Circuit Breaker** (bloqueio automático de transações suspeitas).
  - **Notificação** ao **CERT.br** e **TCU**.
- **Backup:**
  - **Fitas Magnéticas (WORM)** armazenadas em **cofre físico (Air-Gapped)**.
  - **Teste de Restauração:** Semanal.

### **3. Falha na Validação PQC (HSM)**
- **Ação Imediata:**
  - **Switch automático** para o **HSM de Backup**.
  - **Revalidação** de todas as transações pendentes.
- **Tempo Máximo de Recuperação (RTO):** 2 minutos.

---

## **📞 Contatos e Suporte**

| **Tipo**               | **Contato**                          | **Email**                          | **Telefone**       | **Disponibilidade**       |
|------------------------|--------------------------------------|------------------------------------|--------------------|---------------------------|
| **Suporte Técnico**    | Equipe LOWDATAESC                    | suporte@lowdataesc.gov.br          | +55 (61) 9999-9999 | 24/7 (SOC)                |
| **Auditoria (TCU)**    | SEFTI - Tribunal de Contas da União | sefti@tcu.gov.br                   | +55 (61) 3316-3000 | 08:00 - 18:00 (Dias Úteis) |
| **Emergências**        | SOC (Security Operations Center)     | soc@lowdataesc.gov.br              | +55 (61) 9999-0000 | 24/7                      |

---

## **📝 Changelog (Histórico de Versões)**

| **Versão** | **Data**       | **Descrição**                                                                 | **Responsável**       |
|------------|----------------|-------------------------------------------------------------------------------|-----------------------|
| 2.0        | 2024-11-15     | **Lançamento da v2:** Integração PQC, Subledger Imutável, Novos Motores de Decisão | Equipe LOWDATAESC     |
| 1.5        | 2024-08-20     | Adição de validação temporal e assinatura digital (RSA-4096)                | Equipe LOWDATAESC     |
| 1.0        | 2024-01-10     | Versão inicial com validação de invariantes fiscais                          | Equipe LOWDATAESC     |

---

## **🔗 Links Úteis**
- [Documentação Técnica Completa (Confluence)](https://lowdataesc.atlassian.net/wiki)
- [API Reference (Swagger)](https://api.lowdataesc.gov.br/docs)
- [Painel de Auditoria (SEFTI)](https://auditoria.lowdataesc.gov.br)
- [Repositório Git (Interno)](https://git.serpro.gov.br/lowdataesc/lowdataesc-v2)
- [Padrões NIST PQC](https://csrc.nist.gov/projects/post-quantum-cryptography)

---

**⚠️ Aviso Legal:**
Este documento é **confidencial** e destina-se **exclusivamente** ao uso interno do **Tribunal de Contas da União (TCU)** e parceiros autorizados. A divulgação não autorizada pode resultar em **sanções administrativas e penais** de acordo com a **Lei de Acesso à Informação (LAI - Lei 12.527/2011)** e a **Lei de Segurança da Informação (LSI - Lei 13.808/2019)**.

---

**🏛️ Laboratório de Inovação em Auditoria Fiscal**
*Desenvolvido em colaboração com o TCU, Serpro e Dataprev.*
*Powered by LOWDATAESC v2.0 | Criptografia Pós-Quântica NIST | Subledger Imutável WORM*
