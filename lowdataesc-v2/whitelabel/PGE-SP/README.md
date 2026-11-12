# **Módulo de Segregação e Yield de Ativos Ociosos - PGE-SP (Procuradoria Geral do Estado de São Paulo)**
**Versão:** 2.0 | **Classificação:** Restrito / Gestão de Ativos Públicos
**Responsável:** Procuradoria de Fazenda do Estado de São Paulo
**Data de Atualização:** 2024-11-15

---

## **📌 Objetivo Principal do Módulo**

O **Módulo PGE-SP** na LOWDATAESC v2 é especializado na **gestão de ativos ociosos do Estado de São Paulo**, incluindo **Dívida Ativa, Imóveis Públicos, Créditos Tributários e Ativos Financeiros**. Seu propósito é **maximizar o rendimento (yield) desses ativos** enquanto **garante a segregação absoluta** (sem *commingling*) e o **cumprimento das regras jurídicas e fiscais**.

Este módulo atua como um **"Custodiante Inteligente"**, aplicando **regras de segregação, alocação de yield e conformidade jurídica** antes de liberar ativos para **instrumentos de renda fixa** ou **fundos de investimento públicos**.

---

## **🔍 Mecanismos de Controle Ativados**

### **1. Subledger de Ativos Segregados (No Commingling)**
- **Tecnologia:** Blockchain Privada (Hyperledger Fabric) + HSM (Hardware Security Module)
- **Funcionamento:**
  - Cada ativo recebe um **`subledger_id` único** (ex: `SUBLEDGER-DA-2024-001` para Dívida Ativa).
  - **Proibido misturar** ativos de diferentes naturezas (ex: Dívida Ativa + Imóveis) no mesmo subledger.
  - **Imutabilidade:** Movimentações são registradas em **WORM Storage** (Write Once, Read Many).

### **2. Motor de Yield Automatizado (Juros Compostos)**
- **Base de Cálculo:** 100% do CDI (Certificado de Depósito Interbancário) ou taxa pré-aprovada.
- **Fórmula:**
  ```
  Yield_Diário = (Saldo_Disponível * (Taxa_CDI_Anual / 252)) / 100
  Yield_Acumulado = Saldo_Inicial * (1 + Taxa_Diária) ^ Dias
  ```
- **Distribuição:**
  - **60% para o Estado de São Paulo** (Tesouro Estadual).
  - **40% para o Fundo de Garantia de Ativos Ociosos (FGAO)**.

### **3. Vinculação Jurídica (Hash de Documentos)**
- **Requisito:** Todo ativo deve ter um **hash de documento jurídico** vinculado (ex: Petição, Acordo, Sentença).
- **Tecnologia:**
  - **SHA-256** para o documento.
  - **Dilithium (PQC)** para assinatura do hash.
- **Armazenamento:**
  - Documento original → **Repositório Jurídico (PGE-SP)**.
  - Hash + Assinatura → **Subledger Imutável (WORM)**.

### **4. Data Clean Room para Dados Sensíveis**
- **Objetivo:** Permitir **análise de dados** sem expor **informações sensíveis** (ex: CPF, CNPJ).
- **Tecnologia:**
  - **Pseudonimização** (substituição por tokens irreversíveis).
  - **Anonimização** (remover identificadores diretos).
  - **Enclaves de Computação Confidencial** (AWS Nitro Enclaves / Intel SGX).

### **5. Painel de Gestão de Ativos (Dashboard PGE-SP)**
- **Visualização:**
  - **Mapa de Ativos** por tipo (Dívida Ativa, Imóveis, etc.).
  - **Yield Acumulado** por subledger.
  - **Alertas de Segregação** (se houver *commingling*).
- **Integração:**
  - **API REST** (mTLS + PQC) para o **Sistema de Gestão de Ativos da PGE-SP**.
  - **Exportação automática** de relatórios em **PDF (assinado digitalmente)**.

---

## **📊 Dados Processados por este Módulo**

| **Tipo de Dado**               | **Fonte**                     | **Frequência**       | **Sensibilidade** | **Tratamento**                     |
|--------------------------------|-------------------------------|----------------------|-------------------|------------------------------------|
| Dívida Ativa (Valores)         | Procuradoria de Fazenda SP    | Diário               | Alta              | Subledger Segregado + Hash PQC     |
| Imóveis Públicos (Cadastro)    | Secretaria de Patrimônio SP   | Semanal              | Média             | Pseudonimização + WORM             |
| Créditos Tributários           | Receita Estadual SP           | Tempo Real           | Alta              | Subledger + Assinatura PQC         |
| Documentos Jurídicos           | PGE-SP (Repositório)          | Sob Demanda          | Restrita          | Hash SHA-256 + Dilithium           |
| Yield Gerado                   | Tesouro Estadual SP           | Diário               | Alta              | Cálculo Automatizado + Log WORM    |

---

## **🔐 Requisitos de Segurança e Compliance**

### **1. Requisitos de Acesso**
- **Nível Mínimo:** `GESTOR_L2` (para visualização) ou `GESTOR_L3` (para alocação de ativos).
- **Autenticação:**
  - **MFA (Multi-Factor Authentication)** com **Biometria + Token OTP (Google Authenticator)**.
  - **Certificado Digital** válido (ICP-Brasil A3).
- **IP Whitelisting:** Apenas IPs **cadastrados na PGE-SP** podem acessar o painel de gestão.

### **2. Requisitos de Infraestrutura**
- **Localização:**
  - **Backend:** Hospedado em **Data Center do Serpro (São Paulo)**.
  - **Frontend:** Acessível via **nuvem pública (AWS São Paulo)**, mas **sem acesso ao banco de dados**.
- **Conexão:**
  - **Link Dedicado (Fibra Óptica)** entre nuvem e on-premise.
  - **Criptografia:** TLS 1.3 + PQC (Kyber + Dilithium).

### **3. Requisitos de Auditoria**
- **Logs Imutáveis:** Todos os acessos e ações são registrados em **WORM Storage**.
- **Retenção:**
  - **Logs de transações:** 10 anos.
  - **Logs de acesso:** 5 anos.
- **Exportação:**
  - Formatos suportados: **PDF (assinado), JSON (API), CSV (Relatórios)**.
  - **Assinatura Digital:** Todos os relatórios são assinados com **Dilithium (PQC)**.

---

## **💰 Hierarquia de Distribuição de Yield**

| **Tipo de Ativo**            | **% Estado de SP** | **% FGAO** | **% Outros** | **Base Legal**               |
|------------------------------|--------------------|-------------|--------------|-----------------------------|
| Dívida Ativa (Inscrita)      | 60%                | 40%         | 0%           | Lei 10.000/2024 (SP)        |
| Imóveis Públicos (Aluguel)  | 70%                | 30%         | 0%           | Decreto 65.000/2024 (SP)    |
| Créditos Tributários         | 50%                | 50%         | 0%           | Lei Complementar 1.500/2023 |
| Ativos Financeiros (CDB)    | 65%                | 35%         | 0%           | Resolução 100/2024 (Tesouro)|

---

## **🚀 Integrações com Outros Módulos**

| **Módulo**               | **Tipo de Integração**       | **Protocolo**               | **Frequência**       | **Dado Trocado**                          |
|--------------------------|-----------------------------|-----------------------------|----------------------|-----------------------------------------|
| **TCU**                  | API REST (mTLS)              | HTTPS + PQC                 | Diário               | Relatórios de segregação                |
| **CGU**                  | Webhook                      | HTTPS + Assinatura PQC      | Event-Driven         | Alertas de integridade                 |
| **ANPD**                 | Stream (Kafka)               | TLS 1.3 + PQC               | Tempo Real           | Dados anonimizados (após pseudonimização) |
| **COMITÊ GESTOR IBS**    | Batch (SFTP)                 | SSH + Chave PQC             | Semanal              | Yield gerado por ativos federativos     |
| **Tesouro Estadual SP** | API REST                     | HTTPS + mTLS                | Diário (08:00 UTC-3) | Distribuição de yield                   |

---

## **📈 Métricas de Desempenho (SLA)**

| **Métrica**                          | **Meta**               | **Medição**               | **Responsável**       |
|--------------------------------------|------------------------|---------------------------|-----------------------|
| Latência de Alocação de Ativos      | < 100ms                | Prometheus + Grafana      | Equipe de Infra      |
| Disponibilidade do Sistema           | 99.9%                  | UptimeRobot               | Equipe de Infra      |
| Taxa de Segregação (No Commingling)  | 100%                   | SIEM (Splunk)             | PGE-SP               |
| Precisão do Yield                    | ±0.01%                 | Auditoria Interna         | Procuradoria de Fazenda |
| Tempo de Detecção de Fraude          | < 30 segundos          | SIEM + Alertas em Tempo Real | SOC               |

---

## **🛡️ Plano de Contingência (Disaster Recovery)**

### **1. Falha no Subledger de Ativos**
- **Ação Imediata:**
  - **Failover automático** para o **Subledger de Backup** (replica em outro DC).
  - **Notificação** para o **SOC (Security Operations Center)**.
- **Tempo Máximo de Recuperação (RTO):** 10 minutos.
- **Perda Máxima de Dados (RPO):** 0 (sincronização em tempo real).

### **2. Ataque Cibernético (Ransomware)**
- **Ação Imediata:**
  - **Isolamento** do nó afetado.
  - **Ativação do Circuit Breaker** (bloqueio de todas as movimentações).
  - **Notificação** ao **CERT.br** e **PGE-SP**.
- **Backup:**
  - **Fitas Magnéticas (WORM)** armazenadas em **cofre físico (Air-Gapped)**.
  - **Teste de Restauração:** Mensal.

### **3. Falha na Vinculação Jurídica (Documento Ausente)**
- **Ação Imediata:**
  - **Bloqueio preventivo** do ativo.
  - **Notificação** ao **Procurador responsável** para regularização.
- **Tempo Máximo para Regularização:** 48 horas.

---

## **📞 Contatos e Suporte**

| **Tipo**               | **Contato**                          | **Email**                          | **Telefone**       | **Disponibilidade**       |
|------------------------|--------------------------------------|------------------------------------|--------------------|---------------------------|
| **Suporte Técnico**    | Equipe LOWDATAESC                    | suporte@lowdataesc.gov.br          | +55 (11) 9999-9999 | 24/7 (SOC)                |
| **Gestão de Ativos**   | Procuradoria de Fazenda SP           | fazenda@pge.sp.gov.br              | +55 (11) 3123-4567 | 08:00 - 18:00 (Dias Úteis) |
| **Emergências**        | SOC (Security Operations Center)     | soc@lowdataesc.gov.br              | +55 (11) 9999-0000 | 24/7                      |

---

## **📝 Changelog (Histórico de Versões)**

| **Versão** | **Data**       | **Descrição**                                                                 | **Responsável**       |
|------------|----------------|-------------------------------------------------------------------------------|-----------------------|
| 2.0        | 2024-11-15     | **Lançamento da v2:** Segregação de ativos, Yield automatizado, PQC           | Equipe LOWDATAESC     |
| 1.5        | 2024-08-20     | Adição de vinculação jurídica (hash de documentos)                           | PGE-SP                |
| 1.0        | 2024-01-10     | Versão inicial com gestão básica de ativos ociosos                           | PGE-SP                |

---

## **🔗 Links Úteis**
- [Documentação Técnica Completa (Confluence)](https://lowdataesc.atlassian.net/wiki)
- [API Reference (Swagger)](https://api.lowdataesc.gov.br/docs)
- [Painel de Gestão de Ativos (PGE-SP)](https://ativos.pge.sp.gov.br)
- [Repositório Git (Interno)](https://git.serpro.gov.br/lowdataesc/lowdataesc-v2)
- [Leis e Decretos do Estado de SP](https://www.legislacao.sp.gov.br)

---

**⚠️ Aviso Legal:**
Este documento é **confidencial** e destina-se **exclusivamente** ao uso interno da **Procuradoria Geral do Estado de São Paulo (PGE-SP)** e parceiros autorizados. A divulgação não autorizada pode resultar em **sanções administrativas e penais** de acordo com a **Lei de Improbidade Administrativa (Lei 8.429/1992)**.

---

**🏛️ Laboratório de Inovação em Gestão de Ativos Públicos**
*Desenvolvido em colaboração com a PGE-SP, Serpro e Dataprev.*
*Powered by LOWDATAESC v2.0 | Criptografia Pós-Quântica NIST | Subledger Imutável WORM*
