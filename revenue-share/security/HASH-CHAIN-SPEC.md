# Especificao do Hash Chain de Auditoria

**Verso:** 1.0.0  
**Data:** 2024-11-02  
**Responsvel:** Arquitetura LOWDATAESC  
**Status:** Aprovado  

---

## 1. Introduo

### 1.1 Propsito
Este documento define a implementao do **Hash Chain** para garantia de integridade da trilha de auditoria do mulo Revenue Share, permitindo:
- Verificao de integridade de todos os eventos
- Deteco de manipulao ou excluso de registros
- Auditoria imutvel e verificvel

### 1.2 Escopo
Abrange:
- Gerao do hash chain
- Canonicalizao de dados
- Armazenamento imutvel
- Verificao de integridade
- Recuperao e validao

---

## 2. Conceitos

### 2.1 Hash Chain
Cadeia de hashes onde cada registro contm o hash do registro anterior, criando uma cadeia imutvel.

**Exemplo:**
```
Hash_1 = SHA256(Record_1)
Hash_2 = SHA256(Record_2 + Hash_1)
Hash_3 = SHA256(Record_3 + Hash_2)
...
Hash_N = SHA256(Record_N + Hash_{N-1})
```

### 2.2 Canonicalizao
Processo de converter dados para um formato padronizado, determinstico, para garantir que o hash seja consistente.

### 2.3 Imutabilidade
Os registros no podem ser modificados aps serem armazenados. Qualquer modificao quebra a cadeia.

---

## 3. Arquitetura

```mermaid
graph TD
    A[Evento/Operao] --> B[Canonicalizao]
    B --> C[Calcular Hash]
    C --> D[Armazenar com Hash Anterior]
    D --> E[S3 WORM]
    E --> F[Verificao de Integridade]
    
    F -->|Hash Vlido| G[OK]
    F -->|Hash Invlido| H[ALERTA: Manipulao Detectada]
```

---

## 4. Canonicalizao

### 4.1 Regras de Canonicalizao

#### JSON Canonical Form
1. **Ordem de Chaves:** Ordenar chaves em ordem alfabtica
2. **Formatao:** Sem espaos desnecessrios
3. **Valores Nulos:** Remover campos nulos
4. **Tipos:** Manter tipos consistentes (ex: nmeros no como strings)
5. **Data/Hora:** ISO 8601 com timezone UTC

#### Exemplo

**Antes:**
```json
{
  "event_id": "evt_123",
  "amount": 1000.00,
  "timestamp": "2024-11-02T10:00:00Z",
  "currency": "BRL",
  "metadata": null
}
```

**Depois (Canonical):**
```json
{"amount":1000,"currency":"BRL","event_id":"evt_123","timestamp":"2024-11-02T10:00:00Z"}
```

---

### 4.2 Implementao

**Biblioteca:** `json-canonify` (Node.js) ou implementao customizada

**Funo:**
```javascript
function canonicalize(obj) {
    // 1. Remover campos nulos
    const filtered = removeNulls(obj);
    // 2. Ordenar chaves
    const sorted = sortKeys(filtered);
    // 3. Converter para JSON sem espaos
    return JSON.stringify(sorted);
}

function removeNulls(obj) {
    if (obj === null || obj === undefined) return undefined;
    if (typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
        return obj.map(removeNulls).filter(item => item !== undefined);
    }
    
    const result = {};
    for (const key of Object.keys(obj).sort()) {
        const value = removeNulls(obj[key]);
        if (value !== undefined) {
            result[key] = value;
        }
    }
    return result;
}

function sortKeys(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
        return obj.map(sortKeys);
    }
    
    const result = {};
    for (const key of Object.keys(obj).sort()) {
        result[key] = sortKeys(obj[key]);
    }
    return result;
}
```

---

## 5. Hash Chain

### 5.1 Estrutura do Registro

```json
{
    "sequence_number": 1,
    "timestamp": "2024-11-02T10:00:00.000Z",
    "action": "ingest_event",
    "actor": "user_operation_a",
    "resource_type": "revenue_event",
    "resource_id": "evt_550e8400-e29b-41d4-a716-446655440000",
    "payload": {
        "event_id": "evt_550e8400-e29b-41d4-a716-446655440000",
        "operation_id": "op_550e8400-e29b-41d4-a716-446655440001",
        "amount": 1000.00,
        "currency": "BRL",
        "timestamp": "2024-11-02T10:00:00Z",
        "type": "sale",
        "jurisdiction": "BR",
        "source": "api"
    },
    "canonical_form": "{\"amount\":1000,\"currency\":\"BRL\",...}",
    "previous_hash": null,
    "current_hash": "a1b2c3d4e5f6...",
    "signature": "MEUCIQD..."
}
```

---

### 5.2 Clculo do Hash

**Algoritmo:** SHA-256

**Frmula:**
```
current_hash = SHA256(canonical_form + previous_hash)
```

**Exemplo:**
```javascript
const crypto = require('crypto');

function calculateHash(canonicalForm, previousHash) {
    const data = previousHash 
        ? `${canonicalForm}|${previousHash}` 
        : canonicalForm;
    return crypto.createHash('sha256').update(data).digest('hex');
}
```

---

### 5.3 Verificao de Integridade

**Processo:**
1. Recuperar o ltimo registro do hash chain
2. Recalcular o hash a partir do registro anterior
3. Comparar com o hash armazenado
4. Se diferente, a cadeia foi violada

**Funo:**
```javascript
function verifyHashChain(records) {
    let previousHash = null;
    
    for (const record of records) {
        const expectedHash = calculateHash(
            record.canonical_form,
            previousHash
        );
        
        if (expectedHash !== record.current_hash) {
            throw new Error(`Hash mismatch at sequence ${record.sequence_number}`);
        }
        
        previousHash = record.current_hash;
    }
    
    return true;
}
```

---

## 6. Armazenamento

### 6.1 S3 WORM
- **Bucket:** `lowdataesc-audit-hashchain`
- **Object Lock:** 7 anos
- **Versioning:** Habilitado
- **Criptografia:** SSE-KMS (AES-256)

### 6.2 Estrutura de Arquivos
```
/year=2024/month=11/day=02/
  hashchain_2024-11-02_000000000000_000000000001.json
  hashchain_2024-11-02_000000000001_000000000002.json
  ...
```

### 6.3 Indexao
- **Banco de Dados:** PostgreSQL (para consultas rpidas)
- **Tabela:** `audit_hashchain`
- **Campos:** `sequence_number`, `timestamp`, `action`, `actor`, `resource_type`, `resource_id`, `current_hash`, `previous_hash`

---

## 7. Tipos de Eventos

### 7.1 Eventos de Ingesto
- **Ao:** `ingest_event`
- **Recurso:** `revenue_event`
- **Payload:** Evento de receita

### 7.2 Eventos de Clculo
- **Ao:** `create_calculation`, `submit_calculation`, `approve_calculation`, `reject_calculation`
- **Recurso:** `calculation`
- **Payload:** Dados do clculo

### 7.3 Eventos de Liquidao
- **Ao:** `create_instruction`, `send_instruction`, `confirm_instruction`
- **Recurso:** `settlement_instruction`
- **Payload:** Dados da instruo

### 7.4 Eventos de Reconciliao
- **Ao:** `create_reconciliation`, `complete_reconciliation`
- **Recurso:** `reconciliation`
- **Payload:** Dados da reconciliao

### 7.5 Eventos de Disputa
- **Ao:** `create_dispute`, `resolve_dispute`, `reject_dispute`
- **Recurso:** `dispute`
- **Payload:** Dados da disputa

### 7.6 Eventos de Matriz
- **Ao:** `create_matrix`, `approve_matrix`, `activate_matrix`
- **Recurso:** `distribution_matrix`
- **Payload:** Dados da matriz

### 7.7 Eventos de Participante
- **Ao:** `create_participant`, `update_participant`, `deactivate_participant`
- **Recurso:** `participant`
- **Payload:** Dados do participante

---

## 8. Assinatura Digital

### 8.1 Chaves
- **Algoritmo:** ECDSA (P-256) ou RSA (2048 bits)
- **Armazenamento:** HSM ou Vault
- **Rotao:** Automtica a cada 90 dias

### 8.2 Processo de Assinatura
1. Gerar hash do canonical form + previous hash
2. Assinar o hash com a chave privada do ator
3. Armazenar assinatura no registro

### 8.3 Verificao de Assinatura
1. Recuperar chaves pblicas do ator
2. Verificar assinatura com a chave pblica
3. Se invlida, alertar sobre possvel fraude

---

## 9. Verificao Contnua

### 9.1 Processo
1. **Frequncia:** A cada 1000 registros ou diariamente (o que ocorrer primeiro)
2. **Escopo:** Todos os registros desde a ltima verificao
3. **Responsvel:** Audit Service
4. **Ao:** Se falhar, gerar alerta crtico

### 9.2 Alertas
- **Hash Mismatch:** Cadeia violada, possvel manipulao
- **Missing Record:** Registro excludo ou no armazenado
- **Invalid Signature:** Assinatura invlida, possvel falsificao
- **Out of Order:** Registros fora de ordem

---

## 10. Proof Bundle

### 10.1 Definio
Pacote contendo todos os registros de auditoria para um perodo, com:
- Eventos de receita
- Clculos
- Instrues de liquidao
- Reconciliaes
- Disputas
- Trilha de auditoria (hash chain)

### 10.2 Formato
- **Formato:** ZIP
- **Assinatura:** Assinatura digital do pacote
- **Hash:** Hash SHA-256 do pacote

### 10.3 Gerao
```bash
# Gerar proof bundle para um perodo
curl -X POST https://api.lowdataesc.com/revenue-share/v1/audit/proof-bundle \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-11-01T00:00:00Z",
    "end_date": "2024-11-02T23:59:59Z"
  }' \
  --output proof-bundle-2024-11.zip

# Verificar assinatura
openssl dgst -sha256 -verify public_key.pem -signature proof-bundle-2024-11.zip.sig proof-bundle-2024-11.zip
```

---

## 11. Recuperao de Desastres

### 11.1 Backup
- **Frequncia:** Contnuo (S3 versioning)
- **Reteno:** 7 anos
- **Regies:** Multi-region (sa-east-1, us-east-1)

### 11.2 Restore
- **Processo:** Recuperar do S3 e verificar hash chain
- **Teste:** Restore testado mensalmente
- **Tempo:** < 1 hora para restore completo

---

## 12. Critrios de Aceite

- [ ] Canonicalizao implementada e testada
- [ ] Hash chain funcional para todos os eventos
- [ ] Armazenamento imutvel (S3 WORM) configurado
- [ ] Verificao de integridade automtica funcional
- [ ] Assinatura digital implementada
- [ ] Proof bundle gerado e verificvel
- [ ] Recuperao de desastres testada
- [ ] Documentao completa

---

## 13. Anexos

- [Especificao de Auditoria](../governance/AUDIT-PROCEDURE.md)
- [Poltica de Segurana](./SECURITY-POLICY.md)
- [Threat Model](./THREAT-MODEL.md)

---

**Aprovado por:** _________________________  
**Data:** _______________  
**Verso:** 1.0.0
