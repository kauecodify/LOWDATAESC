# **Backend LOWDATAESC v2 - Arquitetura Completa**
**Versão:** 2.0 | **Classificação:** Restrito / Arquitetura de Backend
**Responsável:** Equipe de Arquitetura LOWDATAESC
**Data de Atualização:** 2024-11-15

---

## **📌 Visão Geral do Backend**

O **Backend da LOWDATAESC v2** é uma **arquitetura híbrida soberana**, projetada para processar **operações de alta complexidade** (Reforma Fiscal, Split CBS/IBS, Custódia de Dados) em ambiente **B2G (Business-to-Government)** sem expor o Estado ou as empresas a **riscos sistêmicos, regulatórios ou cibernéticos**.

### **Princípios de Design:**
1. **Soberania de Dados:** Dados sensíveis **nunca saem do território nacional**.
2. **Zero Trust Architecture:** **Nenhum dispositivo ou usuário é confiável por padrão**.
3. **Imutabilidade (WORM):** Todos os registros são **gravados uma vez e nunca alterados**.
4. **Criptografia Pós-Quântica (PQC):** Proteção contra **ataques quânticos futuros**.
5. **Resiliência:** **Failover automático**, backups air-gapped e redundância geográfica.

---

## **🏗️ Arquitetura Geral**

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                        LOWDATAESC v2 - BACKEND                                 │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                        NUVEM PÚBLICA (AWS/Azure/GCP)                       │  │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐       │  │
│  │  │   Frontend      │    │   API Gateway   │    │   CDN           │       │  │
│  │  │   (index.html)  │    │   (Kong/Apigee) │    │   (CloudFront)  │       │  │
│  │  └─────────────────┘    └────────┬────────┘    └─────────────────┘       │  │
│  │                                          │                               │  │
│  │                                          ▼                               │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐    │  │
│  │  │                        MPLS / LINK DEDICADO                         │    │  │
│  │  │  (Conexão Privada - Sem Internet Pública)                         │    │  │
│  │  └─────────────────────────────────────────────────────────────────┘    │  │
│  │                                          │                               │  │
│  └─────────────────────────────────────────┼───────────────────────────────┘  │
│                                            │                                    │
│                                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                     NUVEM LOCAL (ON-PREMISE)                              │  │
│  │  (Data Centers do Serpro/Dataprev - Território Nacional)                │  │
│  │                                                                          │  │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐       │  │
│  │  │    Backend      │    │   Banco de      │    │   HSM           │       │  │
│  │  │    (Node.js)    │    │   Dados         │    │   (FIPS 140-2)  │       │  │
│  │  │                 │    │   (PostgreSQL) │    │   (Thales/Utimaco)│     │  │
│  │  │  • Engine       │    │   • Subledger   │    │   • Chaves PQC  │       │  │
│  │  │  • Compliance   │    │     Imutável    │    │   • Never in RAM│       │  │
│  │  │  • Crypto       │    │   • WORM        │    │                 │       │  │
│  │  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘       │  │
│  │           │                     │                     │                │  │
│  │           ▼                     ▼                     ▼                │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐    │  │
│  │  │                        ENCLAVE DE SEGURANÇA                         │    │  │
│  │  │  • AWS Nitro Enclaves / Intel SGX                                  │    │  │
│  │  │  • Dados processados em ambiente isolado (Data in Use)            │    │  │
│  │  └─────────────────────────────────────────────────────────────────┘    │  │
│  │                                                                          │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐    │  │
│  │  │                        BACKUP AIR-GAPPED                           │    │  │
│  │  │  • Fitas Magnéticas (WORM)                                         │    │  │
│  │  │  • Armazenadas em cofre físico (desconectadas da rede)           │    │  │
│  │  └─────────────────────────────────────────────────────────────────┘    │  │
│  │                                                                          │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## **🌐 Infraestrutura Física e Híbrida (Soberania de Dados)**

### **1. Nuvem Local (On-Premise)**
- **Localização:**
  - **Data Centers do Governo:** Serpro (Brasília, São Paulo, Rio de Janeiro) e Dataprev (Brasília).
  - **Bare Metal Dedicado:** Servidores físicos **exclusivos** para a LOWDATAESC, sem compartilhamento.
- **Objetivo:**
  - **Core da plataforma** (dados brutos, chaves mestras, subledger imutável) **nunca saem do território nacional**.
  - **Conformidade com a LGPD** (Art. 33: transferência internacional de dados).
  - **Conformidade com a LSI** (Lei de Segurança da Informação - Lei 13.808/2019).

### **2. Nuvem Pública (Camada de Apresentação)**
- **Provedores:** AWS (GovCloud), Azure (Government), Google Cloud (Public Sector).
- **Objetivo:**
  - **Frontend (index.html)** e **APIs de baixo risco** rodam em nuvem pública para **alta disponibilidade e baixa latência global**.
  - **Sem acesso direto ao banco de dados principal** (apenas via API Gateway).
- **Regiões:**
  - **AWS:** `us-east-1` (GovCloud), `sa-east-1` (São Paulo).
  - **Azure:** `Brazil South` (São Paulo).
  - **Google Cloud:** `southamerica-east1` (São Paulo).

### **3. Conexão Segura (MPLS / Link Dedicado)**
- **Tecnologia:**
  - **MPLS (Multiprotocol Label Switching):** Rede privada gerenciada por operadoras de telecom.
  - **Fibra Óptica Dedicada:** Conexão física direta entre nuvem pública e on-premise.
- **Segurança:**
  - **Nenhum dado sensível** trafega pela **Internet pública**.
  - **Criptografia:** TLS 1.3 + PQC (Kyber) em todos os túneis.
  - **Monitoramento:** SIEM (Splunk) em tempo real.

---

## **🔒 Hardware de Segurança (O "Cofre" do Backend)**

### **1. HSMs (Hardware Security Modules) FIPS 140-2/3 Nível 3**
- **Objetivo:** **Proteger as chaves criptográficas** que assinam os hashes do subledger e as transações de yield.
- **Características:**
  - **Chaves Nunca em RAM:** As chaves são **geradas e processadas dentro do HSM**, jamais expostas.
  - **Resistência a Tampering:** Dispositivo físico **inviolável** (destrói chaves se aberto).
  - **Suporte a PQC:** Compatível com **CRYSTALS-Kyber e Dilithium**.
- **Modelos Utilizados:**
  | **Modelo**               | **Fabricante** | **Certificação**       | **Localização**       |
  |--------------------------|----------------|------------------------|-----------------------|
  | Luna HSM 7              | Thales         | FIPS 140-2 Nível 3     | Serpro (Brasília)     |
  | CryptoServer CP5        | Utimaco        | FIPS 140-2 Nível 3     | Dataprev (Brasília)   |
  | CloudHSM                | AWS            | FIPS 140-2 Nível 3     | AWS GovCloud          |

### **2. Enclaves de Computação Confidencial**
- **Objetivo:** Processar **dados sensíveis** em um ambiente **completamente isolado**, onde **nem o administrador do sistema pode acessá-los**.
- **Tecnologias:**
  - **AWS Nitro Enclaves:**
    - **Isolamento total:** Ambiente virtual **sem acesso à rede**.
    - **Criptografia de memória:** Todos os dados na RAM são criptografados.
    - **Uso:** Data Clean Room (ANPD), Subledger de CBA (COMITÊ IBS).
  - **Intel SGX (Software Guard Extensions):**
    - **Enclaves de CPU:** Regiões de memória **inacessíveis** até para o sistema operacional.
    - **Remote Attestation:** Verificação criptográfica de que o enclave é legítimo.
    - **Uso:** Motor de Yield (PGE-SP), Validação de Consentimento (ANPD).

### **3. QRNG (Quantum Random Number Generator)**
- **Objetivo:** Gerar **entropia verdadeira** para chaves criptográficas, garantindo que sejam **matematicamente imprevisíveis**.
- **Tecnologia:**
  - **Fenômenos Quânticos:** Usa **ruído de vácuo** ou **emissão de fótons** para gerar números aleatórios.
- **Modelos Utilizados:**
  | **Modelo**               | **Fabricante**      | **Tipo**               | **Localização**       |
  |--------------------------|--------------------|------------------------|-----------------------|
  | Quantis QRNG            | ID Quantique       | Óptico (Fótons)        | Serpro (Brasília)     |
  | qStream                 | QuintessenceLabs   | Eletrônico             | Dataprev (Brasília)   |
  | Cloud QRNG              | AWS                | API (Baseado em HSM)   | AWS GovCloud          |

---

## **🔄 Orquestração e Rede (Zero Trust Architecture)**

### **1. Kubernetes com OPA (Open Policy Agent)**
- **Objetivo:** Orquestrar containers com **políticas de segurança estritas**.
- **Funcionamento:**
  - **OPA (Open Policy Agent):** Atua como um **"porteiro"** que bloqueia qualquer container que tente acessar o banco de dados sem a **assinatura criptográfica correta**.
  - **Políticas:**
    - **Deny by Default:** Todo acesso é **negado por padrão**.
    - **Least Privilege:** Cada container tem **apenas as permissões necessárias**.
    - **Network Policies:** Containers **não podem se comunicar livremente** (microssegmentação).

### **2. Microssegmentação de Rede**
- **Objetivo:** **Isolar cada serviço** para limitar o movimento lateral em caso de ataque.
- **Implementação:**
  - **Motor de Split (Engine):** Pode se comunicar com **Compliance** e **Crypto**, mas **não com o Frontend**.
  - **Motor de Compliance:** Pode se comunicar com **TCU, ANPD, CGU**, mas **não com o Banco de Dados** diretamente.
  - **Motor de Yield (PGE-SP):** **Não pode se comunicar** com o **Motor de Dados Pessoais (ANPD)**.
- **Tecnologia:**
  - **Calico** (para Kubernetes).
  - **Cisco ACI** (para rede física).

### **3. Air-Gapping para Backups**
- **Objetivo:** Proteger backups contra **ransomware e ataques cibernéticos**.
- **Implementação:**
  - **Fitas Magnéticas (WORM):** Backups do **Subledger Imutável** são gravados em fitas magnéticas.
  - **Desconectadas da Rede:** Após a gravação, as fitas são **fisicamente desconectadas** (air-gapped).
  - **Armazenamento:** Cofre físico com **controle de acesso biométrico**.
  - **Teste de Restauração:** **Semanal** (para garantir que os backups são válidos).

---

## **🛡️ Mitigação de Riscos Sistêmicos e Regulatórios**

### **1. Motor de "Circuit Breaker" (Disjuntor)**
- **Objetivo:** **Congelar automaticamente** o sistema em caso de **anomalia em cascata**.
- **Gatilhos:**
  - **3 ou mais anomalias** detectadas em um **período de 5 minutos**.
  - **Falha na API do Banco Central** (Pix, TED, SCR).
  - **Inconsistência massiva** no split do IBS (ex: > 10% das transações com falha).
- **Ações:**
  - **Congelar** a geração de yield.
  - **Bloquear** o saque do escrow.
  - **Notificar** o **SOC, TCU, CGU, COMITÊ IBS**.
  - **Aguardar autorização manual (Multi-Sig)** para retomar operações.

### **2. SIEM com IA e SOC 24/7**
- **Objetivo:** **Monitorar e detectar** ameaças em tempo real.
- **Tecnologia:**
  - **SIEM:** Splunk ou Elastic (ingere todos os logs de acesso).
  - **IA:** Machine Learning para **detectar padrões suspeitos** (ex: acesso fora do horário, IP incomum).
  - **SOC (Security Operations Center):** Equipe **24/7** para responder a incidentes.
- **Ações Automáticas:**
  - **Bloqueio de IP:** Se um IP tentasse **brute-force**, ele é bloqueado em **milissegundos**.
  - **Bloqueio de Usuário:** Se um usuário acessar de um **dispositivo não cadastrado**, a sessão é derrubada.
  - **Notificação:** Alertas são enviados via **Slack, Email, SMS e PagerDuty**.

### **3. Gatekeeping Automático (Defesa contra B2C Inconformes)**
- **Objetivo:** **Bloquear automaticamente** nós (empresas, fintechs) que **não estejam em compliance** com a LGPD, PQC ou outras regulamentações.
- **Implementação:**
  - **Lista Negra (Blacklist):** Nós com **histórico de violações** (ex: vazamento de dados, multas da ANPD).
  - **Lista Branca (Whitelist):** Apenas nós **autorizados** podem se conectar.
  - **Firewall de Aplicação (WAF):** Bloqueio no **nível TCP/IP** (antes mesmo de chegar ao backend).
- **Ações:**
  - **Bloqueio Imediato:** Conexão **derrubada** no firewall.
  - **Notificação:** Alerta enviado à **ANPD, CGU e SOC**.
  - **Investigação:** Análise forense do **tráfego suspeito**.

---

## **🔐 O Papel da Criptografia Pós-Quântica (PQC) no Backend**

### **1. Tunneling PQC (Túneis Seguros)**
- **Objetivo:** **Proteger o tráfego** entre Frontend e Backend contra **ataques quânticos futuros**.
- **Implementação:**
  - **TLS 1.3 Híbrido:** RSA-4096 + **CRYSTALS-Kyber-768**.
  - **Benefício:** Mesmo que o tráfego seja **interceptado e armazenado hoje**, ele **não poderá ser descriptografado no futuro** quando os computadores quânticos amadurecerem (**"Harvest Now, Decrypt Later"**).

### **2. Assinatura de Logs com Dilithium**
- **Objetivo:** **Provar matematicamente** ao TCU e à CGU que os logs de auditoria **não foram forjados**.
- **Implementação:**
  - Cada linha de log é assinada com **CRYSTALS-Dilithium3**.
  - **Benefício:** Mesmo um **administrador de banco de dados mal-intencionado** não pode **alterar os logs** sem ser detectado.

### **3. Criptografia de Dados em Repouso (PQC)**
- **Objetivo:** **Proteger dados armazenados** contra ataques quânticos.
- **Implementação:**
  - **AES-256-GCM + Kyber-768:** Chaves de criptografia são **encapsuladas com Kyber** antes de serem armazenadas.
  - **Benefício:** Mesmo que um atacante **roube o disco rígido**, ele **não poderá descriptografar os dados** sem a chave PQC.

---

## **📊 Estrutura de Pastas do Backend**

```
/backend/
├── engine/          # Regras de split CBS/IBS, CBA, yield e retroalimentação
│   ├── split/        # Divisor de receitas (CBS/IBS)
│   ├── cba/          # Motor de Créditos de Bens de Ativo
│   ├── yield/        # Motor de geração de yield
│   └── README.md     # Documentação do motor
│
├── compliance/      # Motor de auditoria LGPD/BCB/TCU em tempo real
│   ├── lgpd/         # Governança de dados e privacidade
│   ├── bcb/          # Normas do Banco Central (Pix, TED, SCR)
│   ├── tcu/          # Auditoria fiscal e invariantes
│   └── README.md     # Documentação do motor
│
├── crypto/          # Integração PQC e hashing imutável
│   ├── pqc/          # Algoritmos Pós-Quânticos (Kyber, Dilithium)
│   ├── hashing/      # Hashing encadeado (SHA-256, SHA-3)
│   ├── hsm/          # Integração com HSMs (Thales, Utimaco)
│   ├── enclave/      # Enclaves de computação confidencial (Nitro, SGX)
│   └── README.md     # Documentação do módulo
│
└── README.md        # Este arquivo (Arquitetura Geral)
```

---

## **📈 Métricas de Desempenho (SLA)**

| **Métrica**                          | **Meta**               | **Medição**               | **Responsável**       |
|--------------------------------------|------------------------|---------------------------|-----------------------|
| Latência do Backend                  | < 100ms                | Prometheus + Grafana      | Equipe de Infra      |
| Disponibilidade do Sistema           | 99.95%                 | UptimeRobot               | Equipe de Infra      |
| Tempo de Failover                    | < 5 minutos            | Nagios                    | Equipe de Infra      |
| Taxa de Falsos Positivos (Circuit Breaker) | < 0.1% | SIEM (Splunk)       | Equipe de Segurança  |
| Tempo de Detecção de Ameaças         | < 1 segundo            | SIEM + IA                 | SOC                  |
| Tempo de Resolução de Incidentes     | < 15 minutos           | Jira + PagerDuty          | Equipe de Suporte    |

---

## **🚀 Tecnologias Utilizadas**

### **Backend:**
- **Linguagem:** Node.js (TypeScript) + Python (para IA/ML).
- **Framework:** Express.js (API REST), NestJS (Arquitetura Modular).
- **Banco de Dados:** PostgreSQL (Transacional) + Redis (Cache) + MongoDB (Logs).
- **Mensageria:** Apache Kafka (Streaming) + RabbitMQ (Fila).
- **Orquestração:** Kubernetes (EKS, AKS, GKE) + Docker.

### **Segurança:**
- **Criptografia:** OpenSSL 3.0 (Suporte a PQC) + Libsodium.
- **PQC:** CRYSTALS-Kyber, CRYSTALS-Dilithium (Liboqs).
- **HSM:** Thales Luna, Utimaco CryptoServer, AWS CloudHSM.
- **Enclaves:** AWS Nitro Enclaves, Intel SGX.
- **Firewall:** pfSense (On-Premise) + AWS WAF (Nuvem).
- **SIEM:** Splunk, Elastic.

### **Infraestrutura:**
- **On-Premise:** Servidores Dell PowerEdge, Storage EMC, Rede Cisco.
- **Nuvem:** AWS (GovCloud), Azure (Government), Google Cloud (Public Sector).
- **Conexão:** MPLS (Telefônica, Claro, Oi), Fibra Óptica Dedicada.

---

## **📞 Contatos e Suporte**

| **Tipo**               | **Contato**                          | **Email**                          | **Telefone**       | **Disponibilidade**       |
|------------------------|--------------------------------------|------------------------------------|--------------------|---------------------------|
| **Suporte Técnico**    | Equipe LOWDATAESC                    | suporte@lowdataesc.gov.br          | +55 (61) 9999-9999 | 24/7 (SOC)                |
| **Arquitetura**        | Equipe de Arquitetura LOWDATAESC     | arquitetura@lowdataesc.gov.br      | +55 (61) 9999-8888 | 08:00 - 18:00 (Dias Úteis) |
| **Segurança**          | Equipe de Segurança LOWDATAESC       | segurança@lowdataesc.gov.br        | +55 (61) 9999-6666 | 24/7 (SOC)                |
| **Infraestrutura**     | Equipe de Infra LOWDATAESC           | infra@lowdataesc.gov.br            | +55 (61) 9999-5555 | 24/7 (SOC)                |
| **Emergências**        | SOC (Security Operations Center)     | soc@lowdataesc.gov.br              | +55 (61) 9999-0000 | 24/7                      |

---

## **📝 Changelog**

| **Versão** | **Data**       | **Descrição**                                                                 | **Responsável**       |
|------------|----------------|-------------------------------------------------------------------------------|-----------------------|
| 2.0        | 2024-11-15     | **Lançamento da v2:** PQC, Enclaves, HSM, Arquitetura Híbrida Soberana       | Equipe LOWDATAESC     |
| 1.5        | 2024-08-20     | Adição de Circuit Breaker, SIEM com IA, Gatekeeping Automático              | Equipe LOWDATAESC     |
| 1.0        | 2024-01-10     | Versão inicial com Kubernetes, PostgreSQL e API REST                       | Equipe LOWDATAESC     |

---

**⚠️ Aviso Legal:**
Este documento é **confidencial** e destina-se **exclusivamente** ao uso interno da **LOWDATAESC** e parceiros autorizados (TCU, PGE-SP, CGU, ANPD, COMITÊ IBS). A divulgação não autorizada pode resultar em **sanções administrativas e penais**, bem como **comprometimento da segurança nacional**.

---

**🏛️ LOWDATAESC v2.0 | Backend - Arquitetura Híbrida Soberana**
*Desenvolvido em colaboração com o Serpro, Dataprev, TCU, BCB, ANPD e NIST.*
*Powered by Criptografia Pós-Quântica, HSM FIPS 140-2 Nível 3, Enclaves SGX, Subledger Imutável WORM.*
