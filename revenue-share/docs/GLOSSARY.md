# Glossário de Negócio - Módulo Revenue Share

**Versão:** 1.0.0  
**Data:** 2024-11-02  
**Responsável:** Arquitetura LOWDATAESC  

---

## 1. Termos de Receita

### Receita Bruta (Gross Revenue)
**Definição:** Valor total recebido antes de quaisquer deduções ou descontos.  
**Fórmula:** Σ (valor de todos os eventos de receita no período)  
**Exemplo:** R$ 1.000.000,00 em transações processadas  
**Fonte:** Eventos de receita ingressados no sistema  
**Observações:**
- Inclui todos os valores faturados
- Não considera deduções ou impostos
- Base para cálculo de percentuais de distribuição

---

### Receita Líquida (Net Revenue)
**Definição:** Receita bruta após deduções operacionais e impostos retidos na fonte.  
**Fórmula:** Receita Bruta - Deduções  
**Exemplo:** R$ 1.000.000,00 - R$ 150.000,00 = R$ 850.000,00  
**Fonte:** Cálculo do módulo de Revenue Share  
**Observações:**
- Base para distribuição entre participantes
- Deduções são definidas na política contábil

---

### Valor Líquido Distribuível (Distributable Net Value)
**Definição:** Valor disponível para distribuição entre participantes elegíveis após todas as deduções, reservas e ajustes.  
**Fórmula:** Receita Líquida - Reservas - Ajustes  
**Exemplo:** R$ 850.000,00 - R$ 50.000,00 = R$ 800.000,00  
**Fonte:** Cálculo final do módulo  
**Observações:**
- Valor efetivamente distribuído
- Deve ser não-negativo
- Sujeito a pisos e tetos por participante

---

### Rendimento Distribuível (Distributable Income)
**Definição:** Sinônimo de Valor Líquido Distribuível, usado em contextos societários.  
**Fórmula:** Ver Valor Líquido Distribuível  
**Exemplo:** R$ 800.000,00  
**Fonte:** Cálculo final do módulo  
**Observações:**
- Termo usado em documentos societários
- Base para distribuição aos fundadores e investidores

---

## 2. Termos de Deduções

### Dedução (Deduction)
**Definição:** Valor subtraído da receita bruta para obtenção da receita líquida.  
**Tipos:**
- **Taxas operacionais:** Custos de processamento, manutenção, etc.
- **Impostos retidos:** ISS, PIS/COFINS, IRPJ/CSLL retidos na fonte
- **Chargebacks:** Valores devolvidos por contestação
- **Estornos:** Valores devolvidos por erro ou fraude
- **Reservas:** Valores reservados para contingências

---

### Taxa Operacional (Operational Fee)
**Definição:** Custo associado à operação do sistema e processamento de transações.  
**Fórmula:** % da receita bruta ou valor fixo por transação  
**Exemplo:** 1% da receita bruta ou R$ 0,50 por transação  
**Fonte:** Contrato entre operações  
**Observações:**
- Configurável por tipo de evento
- Pode ser fixa ou variável

---

### Imposto Retido (Withheld Tax)
**Definição:** Imposto retido na fonte sobre receitas, conforme legislação aplicável.  
**Tipos:**
- **ISS:** Imposto sobre Serviços (municipal, 2-5% no Brasil)
- **PIS/COFINS:** Contribuições sociais (9,25% no Brasil)
- **IRPJ/CSLL:** Imposto de renda e contribuição social (34% no Brasil)
- **VAT/GST:** Impostos sobre valor agregado (internacional)

**Fórmula:** % conforme alíquota legal  
**Exemplo:** ISS 5% sobre receita de serviços  
**Fonte:** Legislação tributária por jurisdição  
**Observações:**
- Alíquotas variam por país e tipo de operação
- Deve ser calculado conforme jurisdição do evento

---

### Chargeback
**Definição:** Devolução de valor devido à contestação de transação por parte do pagador.  
**Fórmula:** Valor integral da transação + taxas  
**Exemplo:** R$ 1.000,00 (transação) + R$ 20,00 (taxa) = R$ 1.020,00  
**Fonte:** Notificação de chargeback do provedor de pagamento  
**Observações:**
- Impacta a receita líquida
- Deve ser registrado como evento separado
- Sujeito a período de contestação

---

### Estorno (Refund)
**Definição:** Devolução de valor devido a erro operacional, fraude ou solicitação do cliente.  
**Fórmula:** Valor integral ou parcial da transação  
**Exemplo:** R$ 500,00 (devolução parcial)  
**Fonte:** Solicitação de estorno  
**Observações:**
- Pode ser total ou parcial
- Deve ser aprovado conforme workflow
- Impacta a receita líquida

---

### Reserva (Reserve)
**Definição:** Valor reservado para cobrir contingências, garantias ou obrigações futuras.  
**Tipos:**
- **Reserva de contingência:** Para riscos desconhecidos
- **Reserva de liquidez:** Para garantia de pagamento
- **Reserva para chargebacks:** Para cobrir chargebacks futuros
- **Reserva regulatória:** Para conformidade com regulamentações

**Fórmula:** % da receita líquida ou valor fixo  
**Exemplo:** 5% da receita líquida para reserva de contingência  
**Fonte:** Política contábil  
**Observações:**
- Configurável por tipo e período
- Liberada conforme condições definidas

---

## 3. Termos de Distribuição

### Matriz de Distribuição (Distribution Matrix)
**Definição:** Conjunto de regras que define como a receita líquida deve ser distribuída entre participantes.  
**Composição:**
- **Participantes:** Lista de entidades elegíveis
- **Percentuais:** % da receita líquida para cada participante
- **Pisos:** Valor mínimo garantido por participante
- **Tetos:** Valor máximo por participante
- **Prioridades:** Ordem de distribuição
- **Condições de elegibilidade:** Regras para participação

**Fórmula:** Ver [Documento da Matriz de Revenue Share](../models/DISTRIBUTION-MATRIX.md)  
**Exemplo:**
```
Participante A: 33% (piso: R$ 10.000,00, teto: R$ 100.000,00)
Participante B: 67% (piso: R$ 20.000,00)
```
**Fonte:** Contrato entre operações  
**Observações:**
- Deve ser refletida em contrato jurídico
- Pode ser versionada
- Sujeita a aprovação

---

### Participante Elegível (Eligible Participant)
**Definição:** Entidade que atende aos critérios de elegibilidade para receber distribuição de receita.  
**Critérios:**
- **Status ativo:** Participante não desativado
- **Contrato válido:** Contrato em vigor
- **Compliance:** Em conformidade com regulamentações
- **Condições customizadas:** Definidas na DSL de elegibilidade

**Fórmula:** Verificação via DSL  
**Exemplo:** Participante com status = ACTIVE e compliance = OK  
**Fonte:** Cadastro de participantes + DSL  
**Observações:**
- Elegibilidade é verificada a cada cálculo
- Pode ser revogada a qualquer momento

---

### Piso (Floor)
**Definição:** Valor mínimo garantido a um participante em um período de distribuição.  
**Fórmula:** Valor fixo ou % da receita líquida  
**Exemplo:** R$ 10.000,00 ou 1% da receita líquida  
**Fonte:** Matriz de distribuição  
**Observações:**
- Se o cálculo resultar em valor < piso, o participante recebe o piso
- O excesso é distribuído proporcionalmente aos demais participantes
- Configurável por participante

---

### Teto (Cap)
**Definição:** Valor máximo que um participante pode receber em um período de distribuição.  
**Fórmula:** Valor fixo ou % da receita líquida  
**Exemplo:** R$ 100.000,00 ou 20% da receita líquida  
**Fonte:** Matriz de distribuição  
**Observações:**
- Se o cálculo resultar em valor > teto, o participante recebe o teto
- O excesso é redistribuído proporcionalmente aos demais participantes
- Configurável por participante

---

### Percentual de Distribuição (Distribution Percentage)
**Definição:** Percentual da receita líquida (ou valor líquido distribuível) que um participante tem direito a receber.  
**Fórmula:** % definido na matriz de distribuição  
**Exemplo:** 33% para Fundadores Oficiais  
**Fonte:** Matriz de distribuição  
**Observações:**
- Soma dos percentuais pode ser < 100% (reserva) ou > 100% (com pisos/tetos)
- Deve ser não-negativo

---

## 4. Termos de Processo

### Evento de Receita (Revenue Event)
**Definição:** Registro de uma transação ou atividade que gera receita.  
**Atributos obrigatórios:**
- `event_id`: Identificador único
- `operation_id`: Operação que gerou o evento
- `amount`: Valor da receita (bruta)
- `currency`: Moeda (ISO 4217)
- `timestamp`: Data/hora do evento
- `type`: Tipo do evento (sale, fee, interest, etc.)
- `jurisdiction`: Jurisdição (país/região)
- `source`: Fonte do evento (API, batch, etc.)
- `signature`: Assinatura digital para integridade

**Fórmula:** Schema `revenue_event_v1`  
**Exemplo:**
```json
{
  "event_id": "evt_abc123",
  "operation_id": "op_xyz789",
  "amount": 1000.00,
  "currency": "BRL",
  "timestamp": "2024-11-02T10:00:00Z",
  "type": "sale",
  "jurisdiction": "BR",
  "source": "api",
  "signature": "sha256:..."
}
```
**Fonte:** Ingestão de eventos  
**Observações:**
- Deve ser imutável após ingestão
- Sujeito a validação de schema e assinatura

---

### Cálculo (Calculation)
**Definição:** Processo de cálculo da distribuição de receita para um conjunto de eventos.  
**Atributos:**
- `calculation_id`: Identificador único
- `events`: Lista de eventos de receita
- `matrix_version`: Versão da matriz de distribuição aplicada
- `gross_revenue`: Receita bruta total
- `net_revenue`: Receita líquida total
- `distributable_value`: Valor líquido distribuível
- `distributions`: Lista de distribuições por participante
- `deductions`: Lista de deduções aplicadas
- `status`: Status na máquina de estados
- `created_at`: Data/hora da criação
- `updated_at`: Data/hora da última atualização
- `calculation_hash`: Hash para rastreabilidade

**Fórmula:** Ver [Máquina de Estados](./STATE-MACHINE.md)  
**Exemplo:**
```json
{
  "calculation_id": "calc_abc123",
  "matrix_version": "matrix_v1",
  "gross_revenue": 1000000.00,
  "net_revenue": 850000.00,
  "distributable_value": 800000.00,
  "status": "APPROVED",
  "calculation_hash": "sha256:..."
}
```
**Fonte:** Processamento do módulo  
**Observações:**
- Pode ser recalculado em caso de correção
- Sujeito a workflow de aprovação

---

### Instrução de Liquidação (Settlement Instruction)
**Definição:** Instrução para transferência de valores a um participante.  
**Atributos:**
- `instruction_id`: Identificador único
- `calculation_id`: Cálculo associado
- `participant_id`: Participante destino
- `amount`: Valor a ser liquidado
- `currency`: Moeda
- `destination`: Conta escrow ou destino
- `status`: Status (PENDING, PROCESSING, COMPLETED, FAILED)
- `scheduled_at`: Data/hora programada para liquidação
- `completed_at`: Data/hora da conclusão
- `settlement_hash`: Hash para rastreabilidade

**Fórmula:** Schema `settlement_instruction_v1`  
**Exemplo:**
```json
{
  "instruction_id": "instr_abc123",
  "calculation_id": "calc_abc123",
  "participant_id": "part_xyz789",
  "amount": 264000.00,
  "currency": "BRL",
  "destination": "escrow:acc_123",
  "status": "COMPLETED",
  "settlement_hash": "sha256:..."
}
```
**Fonte:** Processamento de liquidação  
**Observações:**
- Deve ser idempotente
- Sujeita a confirmação do LOWDATAESC

---

### Reconciliação (Reconciliation)
**Definição:** Processo de comparação entre eventos de receita e liquidações para verificar consistência.  
**Atributos:**
- `reconciliation_id`: Identificador único
- `period`: Período (data inicial e final)
- `events_total`: Total de eventos no período
- `events_amount`: Valor total de eventos
- `settlements_total`: Total de liquidações no período
- `settlements_amount`: Valor total de liquidações
- `discrepancies`: Lista de divergências
- `status`: Status (PENDING, COMPLETED, FAILED)
- `tolerance`: Tolerância aplicada (ex: 0.01%)

**Fórmula:** Ver [Procedimento de Reconciliação](../accounting/RECONCILIATION-PROCEDURE.md)  
**Exemplo:**
```json
{
  "reconciliation_id": "reconc_abc123",
  "period": {"start": "2024-11-01", "end": "2024-11-02"},
  "events_amount": 1000000.00,
  "settlements_amount": 999999.00,
  "discrepancies": [{"type": "missing_settlement", "amount": 1.00}],
  "status": "COMPLETED",
  "tolerance": 0.0001
}
```
**Fonte:** Processo de reconciliação automática  
**Observações:**
- Executada diariamente (automática) ou sob demanda
- Divergências acima da tolerância geram alertas

---

### Disputa (Dispute)
**Definição:** Contestação formal de um cálculo, liquidação ou evento de receita.  
**Atributos:**
- `dispute_id`: Identificador único
- `calculation_id`: Cálculo associado (opcional)
- `instruction_id`: Instrução associada (opcional)
- `event_id`: Evento associado (opcional)
- `participant_id`: Participante que abriu a disputa
- `reason`: Motivo (calculation_error, wrong_matrix, unrecognized_event, missing_settlement)
- `description`: Descrição detalhada
- `evidence`: Evidências (documentos, logs, etc.)
- `status`: Status (OPEN, INVESTIGATION, RESOLVED, REJECTED)
- `created_at`: Data/hora da abertura
- `resolved_at`: Data/hora da resolução
- `resolution`: Resolução aplicada

**Fórmula:** Ver [Manual de Contestação](../operations/DISPUTE-MANUAL.md)  
**Exemplo:**
```json
{
  "dispute_id": "disp_abc123",
  "calculation_id": "calc_abc123",
  "participant_id": "part_xyz789",
  "reason": "calculation_error",
  "description": "Percentual aplicado está incorreto",
  "status": "RESOLVED",
  "resolution": "Recalculated with correct percentage"
}
```
**Fonte:** Participante ou operador  
**Observações:**
- Sujeita a workflow de resolução
- SLA de 5 dias úteis

---

## 5. Termos de Segurança e Conformidade

### Segregação de Funções (Segregation of Duties)
**Definição:** Princípio que impede que uma única pessoa ou sistema realize todas as etapas de um processo crítico.  
**Aplicação:**
- **Cálculo:** Feito por sistema ou operador A
- **Aprovação:** Feita por operador B (diferente de A)
- **Liquidação:** Feita por sistema ou operador C (diferente de A e B)
- **Auditoria:** Feita por operador D (independente)

**Fórmula:** Matriz RACI  
**Exemplo:** Ver [Matriz RACI](../governance/RACI-MATRIX.md)  
**Fonte:** Política de segurança  
**Observações:**
- Implementada via RBAC e workflows
- Auditada periodicamente

---

### Trilha de Auditoria (Audit Trail)
**Definição:** Registro imutável de todas asações realizadas no sistema.  
**Atributos:**
- `action_id`: Identificador único
- `timestamp`: Data/hora da ação
- `actor`: Quem realizou (user_id, service_id)
- `action`: Tipo da ação (create, update, delete, approve, etc.)
- `resource`: Recurso afetado (calculation_id, instruction_id, etc.)
- `payload`: Dados da ação (antes e depois)
- `hash`: Hash do registro anterior (hash chain)
- `signature`: Assinatura digital

**Fórmula:** Ver [Especificação do Hash Chain](../security/HASH-CHAIN-SPEC.md)  
**Exemplo:**
```json
{
  "action_id": "audit_abc123",
  "timestamp": "2024-11-02T10:00:00Z",
  "actor": "user_xyz789",
  "action": "approve",
  "resource": "calc_abc123",
  "payload": {"status": "APPROVED"},
  "hash": "sha256:...",
  "signature": "sha256:..."
}
```
**Fonte:** Sistema de auditoria  
**Observações:**
- Imutável (S3 WORM)
- Verificável via hash chain

---

### Proof Bundle
**Definição:** Pacote contendo todas as evidências necessárias para auditoria de um período.  
**Conteúdo:**
- Eventos de receita
- Cálculos
- Aprovações
- Instruções de liquidação
- Reconciliações
- Disputas
- Trilha de auditoria

**Fórmula:** ZIP com assinatura digital  
**Exemplo:** `proof-bundle-2024-11.zip.sig`  
**Fonte:** Exportação periódica ou sob demanda  
**Observações:**
- Usado para auditorias externas
- Deve ser verificável independentemente

---

## 6. Termos Societários

### Fundadores Oficiais (Official Founders)
**Definição:** Fundadores originais da LOWDATAESC, com direito a 33% dos Rendimentos Distribuíveis.  
**Composição:** Lista definida no contrato social  
**Fórmula:** 33% do Valor Líquido Distribuível  
**Exemplo:** 3 fundadores com 11% cada  
**Fonte:** Contrato social e acordo de sócios  
**Observações:**
- Percentual fixo conforme contrato
- Sujeito a vesting (se aplicável)

---

### Pré-Seed
**Definição:** Rodada de investimento inicial, com direito a 67% dos Rendimentos Distribuíveis.  
**Composição:** Investidores da rodada Pré-Seed  
**Fórmula:** 67% do Valor Líquido Distribuível  
**Exemplo:** 10 investidores com percentuais variados  
**Fonte:** Acordo de investimento  
**Observações:**
- Percentual negociado conforme term sheet
- Sujeito a diluição em rodadas futuras

---

### Vesting
**Definição:** Mecanismo pelo qual os direitos de um participante (ex: fundador) são adquiridos gradualmente ao longo do tempo.  
**Atributos:**
- **Cliff:** Período inicial sem aquisição de direitos
- **Cronograma:** Período de aquisição (ex: 4 anos)
- **Frequência:** Mensal, trimestral, etc.
- **Aceleração:** Condições para aquisição antecipada
- **Good Leaver:** Tratamento para saída amigável
- **Bad Leaver:** Tratamento para saída não amigável

**Fórmula:** Ver [Instrumento de Vesting](../legal/VESTING-AGREEMENT.md)  
**Exemplo:** Cliff de 1 ano + 4 anos de vesting mensal  
**Fonte:** Acordo de sócios  
**Observações:**
- Aplicável a fundadores e possivelmente a outros participantes
- Minuta já redigida, aguardando formalização

---

### Cap Table
**Definição:** Tabela que mostra a distribuição de participação acionária ou de direitos de receita entre todos os participantes.  
**Atributos:**
- `participant_id`: Identificador do participante
- `name`: Nome do participante
- `type`: Tipo (fundador, investidor, funcionário, etc.)
- `percentage`: % de participação
- `vesting_status`: Status do vesting (se aplicável)
- `diluition`: Histórico de diluição

**Fórmula:** Ver [Cap Table Atualizada](../legal/CAP-TABLE.md)  
**Exemplo:**
```
Fundador A: 11% (vested: 5%, unvested: 6%)
Fundador B: 11% (vested: 5%, unvested: 6%)
Fundador C: 11% (vested: 5%, unvested: 6%)
Investidor X: 50% (fully vested)
Investidor Y: 17% (fully vested)
```
**Fonte:** Documentação societária  
**Observações:**
- Deve ser mantida atualizada
- Reflete a diluição das rodadas de investimento

---

## 7. Termos Técnicos

### Idempotência (Idempotency)
**Definição:** Propriedade de uma operação que pode ser executada múltiplas vezes sem alterar o resultado além da primeira execução.  
**Aplicação:**
- Ingestão de eventos
- Cálculo de distribuição
- Liquidação

**Fórmula:** Uso de IDs únicos + deduplicação  
**Exemplo:** Reenvio do mesmo evento não duplica o registro  
**Fonte:** Implementação do sistema  
**Observações:**
- Crítica para prevenir duplicações
- Implementada via `idempotency_key`

---

### Hash Chain
**Definição:** Cadeia de hashes onde cada registro contém o hash do registro anterior, permitindo verificação de integridade de toda a cadeia.  
**Algoritmo:** SHA-256  
**Fórmula:** `hash_n = SHA256(data_n + hash_{n-1})`  
**Exemplo:**
```
hash_1 = SHA256(data_1)
hash_2 = SHA256(data_2 + hash_1)
hash_3 = SHA256(data_3 + hash_2)
```
**Fonte:** Sistema de auditoria  
**Observações:**
- Permite detecção de manipulação
- Usado para trilha de auditoria

---

### Canonicalização (Canonicalization)
**Definição:** Processo de converter dados para um formato padrão, determinístico, para garantir que o hash seja consistente.  
**Aplicação:**
- JSON canonical form (ordem de chaves, formatação)
- XML canonical form

**Fórmula:** Ver [Especificação de Canonicalização](../security/CANONICALIZATION-SPEC.md)  
**Exemplo:**
```json
// Antes: {"b": 2, "a": 1}
// Depois: {"a": 1, "b": 2}
```
**Fonte:** Implementação de hash chain  
**Observações:**
- Crítica para consistência de hashes
- Deve ser determinística

---

## 8. Siglas e Abreviaturas

| Sigla | Significado | Descrição |
|-------|-------------|-----------|
| API | Application Programming Interface | Interface para integração de sistemas |
| BCB | Banco Central do Brasil | Autoridade monetária brasileira |
| CVM | Comissão de Valores Mobiliários | Autarquia reguladora do mercado de capitais |
| DLP | Data Loss Prevention | Prevenção de perda de dados |
| DSL | Domain-Specific Language | Linguagem específica de domínio |
| GDPR | General Data Protection Regulation | Regulamento Geral de Proteção de Dados (UE) |
| HSM | Hardware Security Module | Módulo de segurança de hardware |
| ISO | International Organization for Standardization | Organização Internacional de Normalização |
| JWT | JSON Web Token | Token de autenticação |
| KMS | Key Management Service | Serviço de gerenciamento de chaves |
| LGPD | Lei Geral de Proteção de Dados | Lei brasileira de proteção de dados |
| mTLS | Mutual TLS | TLS com autenticação mútua |
| OPA | Open Policy Agent | Motor de políticas |
| RBAC | Role-Based Access Control | Controle de acesso baseado em roles |
| RPO | Recovery Point Objective | Objetivo de ponto de recuperação |
| RTO | Recovery Time Objective | Objetivo de tempo de recuperação |
| SLA | Service Level Agreement | Acordo de nível de serviço |
| SOC | System and Organization Controls | Controles de sistema e organização |
| SUSEP | Superintendência de Seguros Privados | Autarquia reguladora de seguros |
| TLS | Transport Layer Security | Protocolo de segurança de transporte |
| WORM | Write Once, Read Many | Gravação única, leitura múltipla |

---

**Versão:** 1.0.0  
**Data:** 2024-11-02  
**Responsável:** Arquitetura LOWDATAESC
