# **Módulo de Criptografia Pós-Quântica (PQC) e Hashing Imutável**
**Versão:** 2.0 | **Classificação:** Restrito / Segurança Criptográfica
**Responsável:** Equipe de Segurança LOWDATAESC
**Data de Atualização:** 2024-11-15

---

## **📌 Visão Geral**

O **Módulo de Criptografia Pós-Quântica (PQC)** é o **fundamento de segurança** da LOWDATAESC v2, projetado para **resistir a ataques quânticos futuros** (Harvest Now, Decrypt Later) enquanto mantém **compatibilidade com os padrões atuais** (RSA, ECC).

Este módulo implementa:
1. **Criptografia Pós-Quântica (PQC):** Algoritmos **resistentes a computadores quânticos**, conforme **padrões NIST** (CRYSTALS-Kyber, CRYSTALS-Dilithium).
2. **Hashing Imutável:** **SHA-256 + PQC** para garantir **integridade e não-repúdio** de todos os registros.
3. **HSM (Hardware Security Module):** **Chaves criptográficas** jamais tocam a memória RAM do servidor.
4. **Enclaves de Computação Confidencial:** Processamento de dados sensíveis em **ambientes isolados** (AWS Nitro Enclaves, Intel SGX).
5. **QRNG (Quantum Random Number Generator):** Geração de **entropia verdadeira** para chaves criptográficas.

---

## **🏗️ Arquitetura do Módulo**

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                     MÓDULO DE CRIPTOGRAFIA PQC                                 │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐          │
│  │   PQC Core     │    │  Hashing Engine │    │   HSM Module    │          │
│  │                 │    │                 │    │                 │          │
│  │ • Kyber (KEM)  │    │ • SHA-256       │    │ • FIPS 140-2 L3 │          │
│  │ • Dilithium    │    │ • SHA-3         │    │ • Chaves PQC    │          │
│  │   (Signatures) │    │ • BLAKE3        │    │ • Never in RAM  │          │
│  │ • NTRU (Backup)│    │ • Encadeado     │    │                 │          │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘          │
│           │                     │                     │                    │
│           ▼                     ▼                     ▼                    │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │                        ENCLAVE DE SEGURANÇA                          │     │
│  │  • AWS Nitro Enclaves / Intel SGX                                  │     │
│  │  • Dados processados em ambiente isolado (Data in Use)              │     │
│  │  • Nem o root pode acessar os dados durante o processamento        │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │                        QRNG (Quantum RNG)                           │     │
│  │  • Entropia verdadeira (hardware)                                  │     │
│  │  • Chaves matematicamente imprevisíveis                            │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## **🔐 Algoritmos de Criptografia Pós-Quântica (PQC)**

### **1. CRYSTALS-Kyber (Key Encapsulation Mechanism - KEM)**
- **Padrão:** NIST PQC Standard (FIPS 203)
- **Uso:** **Criptografia de chaves** (troca segura de chaves simétricas).
- **Segurança:** Resistente a ataques de **Shor's Algorithm** (computadores quânticos).
- **Tamanho de Chave:**
  | **Nível de Segurança** | **Tamanho da Chave (KB)** | **Tamanho do Ciphertext (KB)** | **Aplicação**          |
  |------------------------|----------------------------|--------------------------------|------------------------|
  | Kyber-512              | 0.8                        | 0.728                          | Nível 1 (128 bits)    |
  | **Kyber-768**          | **1.2**                    | **1.088**                      | **Nível 3 (192 bits)** |
  | Kyber-1024             | 1.6                        | 1.568                          | Nível 5 (256 bits)    |
- **Implementação na LOWDATAESC:**
  - Usado para **criptografar chaves de sessão** antes de enviá-las pelo canal.
  - **Nível 3 (Kyber-768)** é o padrão para **dados sensíveis** (ex: subledger de CBA).

### **2. CRYSTALS-Dilithium (Digital Signatures)**
- **Padrão:** NIST PQC Standard (FIPS 204)
- **Uso:** **Assinaturas digitais** para **logs de auditoria, transações e contratos**.
- **Segurança:** Resistente a ataques de **Grover's Algorithm** (computadores quânticos).
- **Tamanho de Chave:**
  | **Nível de Segurança** | **Tamanho da Chave (KB)** | **Tamanho da Assinatura (KB)** | **Aplicação**          |
  |------------------------|----------------------------|----------------------------------|------------------------|
  | Dilithium2             | 1.9                        | 2.420                            | Nível 2 (128 bits)    |
  | **Dilithium3**         | **2.5**                    | **3.217**                        | **Nível 3 (192 bits)** |
  | Dilithium5             | 3.2                        | 4.508                            | Nível 5 (256 bits)    |
- **Implementação na LOWDATAESC:**
  - Usado para **assinar todos os logs de auditoria** (TCU, CGU, ANPD).
  - **Nível 3 (Dilithium3)** é o padrão para **transações fiscais**.

### **3. NTRU (Backup - Key Exchange)**
- **Padrão:** NIST PQC Candidate (Backup para Kyber)
- **Uso:** **Alternativa ao Kyber** em caso de falha.
- **Segurança:** Baseado em **reticulados (lattices)**.
- **Implementação na LOWDATAESC:**
  - Usado como **fallback** caso o Kyber não esteja disponível.

---

## **🔧 Funcionalidades Principais**

### **1. Criptografia Híbrida (PQC + Clássica)**
- **Objetivo:** Garantir **compatibilidade com sistemas legados** enquanto prepara para o **futuro quântico**.
- **Implementação:**
  - **TLS 1.3 Híbrido:** RSA-4096 + CRYSTALS-Kyber-768.
  - **Assinaturas Híbridas:** ECDSA (secp256r1) + CRYSTALS-Dilithium3.
- **Benefício:**
  - **Hoje:** Segurança com RSA/ECC (padrão atual).
  - **Futuro:** Segurança com PQC (resistente a computadores quânticos).

### **2. Hashing Imutável (SHA-256 + PQC)**
- **Objetivo:** Garantir **integridade e não-repúdio** de todos os registros.
- **Implementação:**
  - **SHA-256:** Hash padrão para dados.
  - **Encadeamento:** Cada registro inclui o **hash do registro anterior**.
  - **Assinatura PQC:** Cada hash é **assinado com Dilithium3**.
- **Exemplo:**
  ```json
  {
    "tx_id": "UUID_123",
    "data": "{...}",
    "hash_anterior": "a1b2c3...",
    "hash_atual": "SHA256(data + hash_anterior)",
    "assinatura_PQC": "Dilithium3_Signature(hash_atual)"
  }
  ```

### **3. HSM (Hardware Security Module)**
- **Objetivo:** **Proteger as chaves criptográficas** contra acesso não autorizado.
- **Implementação:**
  - **FIPS 140-2 Nível 3:** Módulo de segurança físico inviolável.
  - **Chaves Nunca em RAM:** As chaves são **geradas e processadas dentro do HSM**, jamais expostas.
  - **Suporte a PQC:** HSMs compatíveis com **CRYSTALS-Kyber e Dilithium**.
- **Modelos Suportados:**
  - **Thales Luna HSM** (FIPS 140-2 Nível 3).
  - **Utimaco CryptoServer** (FIPS 140-2 Nível 3).
  - **AWS CloudHSM** (FIPS 140-2 Nível 3).

### **4. Enclaves de Computação Confidencial**
- **Objetivo:** Processar **dados sensíveis** em um ambiente **completamente isolado**.
- **Implementação:**
  - **AWS Nitro Enclaves:**
    - **Isolamento total:** Nem o administrador do AWS pode acessar os dados.
    - **Sem acesso à rede:** O enclave não tem conexão com a internet.
    - **Criptografia de memória:** Todos os dados na RAM são criptografados.
  - **Intel SGX (Software Guard Extensions):**
    - **Enclaves de CPU:** Regiões de memória **inacessíveis** até para o sistema operacional.
    - **Remote Attestation:** Verificação criptográfica de que o enclave é legítimo.
- **Uso na LOWDATAESC:**
  - **Data Clean Room (ANPD):** Processamento de dados pessoais.
  - **Subledger de CBA (COMITÊ IBS):** Tokenização de créditos tributários.
  - **Motor de Yield (PGE-SP):** Cálculo de juros compostos sobre ativos ociosos.

### **5. QRNG (Quantum Random Number Generator)**
- **Objetivo:** Gerar **entropia verdadeira** para chaves criptográficas.
- **Implementação:**
  - **Hardware QRNG:** Dispositivo físico que usa **fenômenos quânticos** (ex: ruído de vácuo) para gerar números aleatórios.
  - **Modelos Suportados:**
    - **ID Quantique Quantis QRNG**.
    - **QuintessenceLabs qStream**.
    - **AWS Cloud QRNG** (via API).
- **Uso na LOWDATAESC:**
  - Geração de **chaves de sessão PQC**.
  - **Seeds para HSMs** (chaves mestras).

---

## **🔧 Integrações com Outros Módulos**

| **Módulo**               | **Tipo de Integração**       | **Protocolo**               | **Dado Troca**                          |
|--------------------------|-----------------------------|-----------------------------|-----------------------------------------|
| **Engine**              | RPC (gRPC + PQC)             | TLS 1.3 + Kyber             | Assinaturas de transações (Dilithium)   |
| **Compliance**          | API REST (mTLS)              | HTTPS + PQC                 | Assinaturas de logs de auditoria        |
| **Frontend**            | WebSocket (WSS)              | TLS 1.3 + Kyber             | Dados criptografados para o cliente    |
| **TCU**                 | API REST (mTLS)              | HTTPS + PQC                 | Assinaturas de relatórios               |
| **PGE-SP**              | Stream (Kafka + PQC)         | TLS 1.3 + Kyber             | Dados de ativos ociosos (criptografados)|
| **CGU**                 | API REST                     | HTTPS + mTLS                | Assinaturas de logs de integridade      |
| **ANPD**                | Batch (SFTP + PQC)           | SSH + Kyber                 | Dados anonimizados (criptografados)    |
| **COMITÊ GESTOR IBS**   | API REST                     | HTTPS + mTLS                | Assinaturas de CBA                      |

---

## **📈 Métricas de Desempenho (SLA)**

| **Métrica**                          | **Meta**               | **Medição**               | **Responsável**       |
|--------------------------------------|------------------------|---------------------------|-----------------------|
| Latência de Assinatura PQC          | < 10ms                 | Prometheus + Grafana      | Equipe de Infra      |
| Latência de Criptografia PQC         | < 20ms                 | Prometheus + Grafana      | Equipe de Infra      |
| Latência de Hashing                  | < 1ms                  | Prometheus + Grafana      | Equipe de Infra      |
| Disponibilidade do HSM               | 99.999%                | UptimeRobot               | Equipe de Infra      |
| Disponibilidade dos Enclaves         | 99.95%                 | UptimeRobot               | Equipe de Infra      |
| Taxa de Falsificação de Assinaturas   | 0%                     | Auditoria Interna         | Equipe de Segurança  |

---

## **🛡️ Segurança e Compliance**

### **1. Padrões de Segurança**
- **FIPS 140-2 Nível 3:** Para HSMs (Hardware Security Modules).
- **FIPS 203/204:** Para algoritmos PQC (Kyber, Dilithium).
- **ISO 27001:** Para gestão de segurança da informação.
- **PCI DSS:** Para processamento de pagamentos (Pix, TED).

### **2. Auditoria**
- **Logs de Criptografia:** Todos os acessos ao HSM e enclaves são **registrados em WORM Storage**.
- **Retenção:** 10 anos (padrão governamental).
- **Exportação:** Relatórios em PDF (assinado), JSON (API).

### **3. Plano de Contingência**
- **Falha no HSM Principal:**
  - **Failover automático** para o **HSM de Backup**.
  - **Tempo de Recuperação (RTO):** < 1 segundo.
- **Falha nos Enclaves:**
  - **Failover** para outro enclave em um **DC diferente**.
  - **Tempo de Recuperação (RTO):** < 5 minutos.
- **Ataque Quântico (Futuro):**
  - **Migração automática** para algoritmos PQC de **nível superior** (ex: Kyber-1024, Dilithium5).

---

## **📁 Estrutura de Arquivos**

```
/backend/crypto/
├── pqc/
│   ├── kyber/
│   │   ├── keygen.js            # Geração de chaves Kyber
│   │   ├── encrypt.js           # Criptografia com Kyber
│   │   ├── decrypt.js           # Descriptografia com Kyber
│   │   └── utils.js             # Funções utilitárias
│   │
│   ├── dilithium/
│   │   ├── keygen.js            # Geração de chaves Dilithium
│   │   ├── sign.js              # Assinatura digital com Dilithium
│   │   ├── verify.js            # Verificação de assinatura
│   │   └── utils.js             # Funções utilitárias
│   │
│   └── ntru/
│       ├── keygen.js            # Geração de chaves NTRU (Backup)
│       ├── encrypt.js           # Criptografia com NTRU
│       └── decrypt.js           # Descriptografia com NTRU
│
├── hashing/
│   ├── sha256.js               # Hashing com SHA-256
│   ├── sha3.js                 # Hashing com SHA-3
│   ├── blake3.js               # Hashing com BLAKE3
│   └── chain.js                # Hashing encadeado (para Subledger)
│
├── hsm/
│   ├── thales/
│   │   └── client.js            # Cliente para Thales Luna HSM
│   │
│   ├── utimaco/
│   │   └── client.js            # Cliente para Utimaco CryptoServer
│   │
│   └── aws/
│       └── cloudhsm.js          # Cliente para AWS CloudHSM
│
├── enclave/
│   ├── aws/
│   │   └── nitro.js             # Integração com AWS Nitro Enclaves
│   │
│   └── intel/
│       └── sgx.js               # Integração com Intel SGX
│
├── qrng/
│   ├── idquantique/
│   │   └── client.js            # Cliente para ID Quantique QRNG
│   │
│   ├── quintessence/
│   │   └── client.js            # Cliente para QuintessenceLabs qStream
│   │
│   └── aws/
│       └── cloudqrng.js         # Cliente para AWS Cloud QRNG
│
├── services/
│   ├── PQCService.js           # Serviço unificado de PQC
│   ├── HashingService.js       # Serviço de hashing
│   ├── HSMService.js           # Serviço de HSM
│   ├── EnclaveService.js       # Serviço de enclaves
│   └── QRNGService.js          # Serviço de QRNG
│
└── README.md                    # Este arquivo
```

---

## **🚀 Como Usar (Exemplo de Código)**

### **1. Assinatura Digital com Dilithium (PQC)**
```javascript
const { Dilithium } = require('./pqc/dilithium');

// Gerar chaves
const { publicKey, privateKey } = Dilithium.generateKeyPair();

// Assinar dados
const data = "Transação CBS/IBS: Valor_CBS=4000000, Valor_IBS=8000000";
const signature = Dilithium.sign(data, privateKey);

// Verificar assinatura
const isValid = Dilithium.verify(data, signature, publicKey);
console.log("Assinatura válida?", isValid); // true
```

### **2. Criptografia com Kyber (PQC)**
```javascript
const { Kyber } = require('./pqc/kyber');

// Gerar chaves
const { publicKey, privateKey } = Kyber.generateKeyPair();

// Criptografar (encapsular chave simétrica)
const { ciphertext, sharedSecret } = Kyber.encrypt(publicKey);

// Descriptografar (extrair chave simétrica)
const decryptedSecret = Kyber.decrypt(ciphertext, privateKey);
console.log("Chaves iguais?", sharedSecret === decryptedSecret); // true
```

### **3. Hashing Encadeado (Subledger Imutável)**
```javascript
const { ChainHashing } = require('./hashing/chain');

const chain = new ChainHashing();

// Adicionar primeiro bloco
const block1 = { tx_id: "UUID_1", data: "Transação 1" };
chain.addBlock(block1);

// Adicionar segundo bloco (inclui hash do anterior)
const block2 = { tx_id: "UUID_2", data: "Transação 2" };
chain.addBlock(block2);

// Verificar integridade
const isValid = chain.validate();
console.log("Cadeia válida?", isValid); // true
```

### **4. Uso do HSM (Thales Luna)**
```javascript
const { ThalesHSM } = require('./hsm/thales/client');

const hsm = new ThalesHSM({
  host: "10.0.0.1",
  port: 1792,
  slot: 1,
  pin: "*******"
});

// Gerar chave PQC no HSM
const keyHandle = await hsm.generatePQCKey("Dilithium3");

// Assinar dados com a chave no HSM
const data = "Dados sensíveis";
const signature = await hsm.sign(data, keyHandle);

console.log("Assinatura gerada no HSM:", signature);
```

### **5. Processamento em Enclave (AWS Nitro)**
```javascript
const { NitroEnclave } = require('./enclave/aws/nitro');

const enclave = new NitroEnclave({
  imageUri: "123456789012.dkr.ecr.us-east-1.amazonaws.com/lowdataesc-enclave:latest",
  cpuCount: 2,
  memoryMiB: 4096
});

// Iniciar enclave
await enclave.start();

// Enviar dados para processamento (criptografados)
const encryptedData = encryptData("Dados sensíveis");
const result = await enclave.process(encryptedData);

console.log("Resultado do enclave:", result);

// Parar enclave
await enclave.stop();
```

---

## **📞 Contatos e Suporte**

| **Tipo**               | **Contato**                          | **Email**                          | **Telefone**       |
|------------------------|--------------------------------------|------------------------------------|--------------------|
| **Suporte Técnico**    | Equipe LOWDATAESC                    | suporte@lowdataesc.gov.br          | +55 (61) 9999-9999 |
| **Segurança**          | Equipe de Segurança LOWDATAESC       | segurança@lowdataesc.gov.br        | +55 (61) 9999-6666 |
| **Emergências**        | SOC (Security Operations Center)     | soc@lowdataesc.gov.br              | +55 (61) 9999-0000 |
| **HSM (Thales)**       | Thales Support                       | support@thalesgroup.com            | +1 (800) 123-4567  |
| **AWS CloudHSM**       | AWS Support                          | support@amazon.com                 | +1 (800) 123-4567  |

---

## **📝 Changelog**

| **Versão** | **Data**       | **Descrição**                                                                 | **Responsável**       |
|------------|----------------|-------------------------------------------------------------------------------|-----------------------|
| 2.0        | 2024-11-15     | **Lançamento da v2:** Integração PQC (Kyber, Dilithium), HSM, Enclaves SGX    | Equipe LOWDATAESC     |
| 1.5        | 2024-08-20     | Adição de QRNG e suporte a NTRU (Backup)                                    | Equipe LOWDATAESC     |
| 1.0        | 2024-01-10     | Versão inicial com RSA-4096 e SHA-256                                        | Equipe LOWDATAESC     |

---

## **🔗 Links Úteis**

- [NIST PQC Standards](https://csrc.nist.gov/projects/post-quantum-cryptography)
- [CRYSTALS-Kyber (GitHub)](https://github.com/pq-crystals/kyber)
- [CRYSTALS-Dilithium (GitHub)](https://github.com/pq-crystals/dilithium)
- [AWS Nitro Enclaves](https://aws.amazon.com/ec2/nitro/nitro-enclaves/)
- [Intel SGX](https://www.intel.com/content/www/us/en/developer/tools/software-guard-extensions/overview.html)
- [FIPS 140-2](https://csrc.nist.gov/projects/cryptographic-module-validation-program)

---

**⚠️ Aviso Legal:**
Este documento é **confidencial** e destina-se **exclusivamente** ao uso interno da **LOWDATAESC** e parceiros autorizados. A divulgação não autorizada pode resultar em **sanções administrativas e penais**, bem como **comprometimento da segurança nacional**.

---

**🏛️ LOWDATAESC v2.0 | Módulo de Criptografia Pós-Quântica**
*Desenvolvido em colaboração com o NIST, Serpro, Dataprev e AWS.*
*Powered by CRYSTALS-Kyber, CRYSTALS-Dilithium, HSM FIPS 140-2 Nível 3, Enclaves SGX.*
