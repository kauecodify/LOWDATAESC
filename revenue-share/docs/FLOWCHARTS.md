# Fluxogramas de Processo - Módulo Revenue Share

**Versão:** 1.0.0  
**Data:** 2024-11-02  
**Responsável:** Arquitetura LOWDATAESC  

---

## 1. Fluxo de Ingestão de Eventos de Receita

```mermaid
graph TD
    A[Início] --> B[Receber Evento]
    B --> C{Validação de Schema?}
    C -->|Sim| D[Validar Assinatura Digital]
    C -->|Não| E[Rejeitar com Erro]
    D --> F{Assinatura Válida?}
    F -->|Sim| G[Verificar Idempotência]
    F -->|Não| E
    G --> H{Evento Duplicado?}
    H -->|Sim| I[Retornar ID Existente]
    H -->|Não| J[Normalizar Dados]
    J --> K[Armazenar em S3 WORM]
    K --> L[Indexar no Banco de Dados]
    L --> M[Publicar em Kafka]
    M --> N[Retornar Sucesso]
    E --> N
    I --> N
    
    style A fill:#00ff00,stroke:#000
    style N fill:#00ff00,stroke:#000
    style E fill:#ff0000,stroke:#000
```

### Descrição Detalhada:

1. **Receber Evento**: API REST, Kafka ou Batch Upload
2. **Validação de Schema**: Verificar conformidade com `revenue_event_v1`
3. **Validar Assinatura Digital**: Verificar assinatura com chave pública do emissor
4. **Verificar Idempotência**: Usar `event_id` ou hash do payload
5. **Normalizar Dados**: Converter para schema canônico
6. **Armazenar em S3 WORM**: Imutável, 7 anos de retenção
7. **Indexar no Banco**: PostgreSQL para consultas rápidas
8. **Publicar em Kafka**: Para processamento assíncrono

---

## 2. Fluxo de Cálculo de Distribuição

```mermaid
graph TD
    A[Início] --> B[Selecionar Eventos do Período]
    B --> C[Agregar por Tipo e Operação]
    C --> D[Calcular Receita Bruta]
    D --> E[Aplicar Deduções]
    E --> F[Calcular Receita Líquida]
    F --> G[Carregar Matriz de Distribuição]
    G --> H[Verificar Versão da Matriz]
    H --> I{Versão Atual?}
    I -->|Sim| J[Aplicar Percentuais]
    I -->|Não| K[Carregar Versão Correta]
    K --> J
    J --> L[Calcular Distribuição por Participante]
    L --> M[Aplicar Pisos e Tetos]
    M --> N[Ajustar para 100%]
    N --> O[Calcular Valor Líquido Distribuível]
    O --> P[Gerar Calculation]
    P --> Q[Calcular Hash do Cálculo]
    Q --> R[Armazenar Calculation]
    R --> S[Criar Trilha de Auditoria]
    S --> T[Retornar Calculation ID]
    
    style A fill:#00ff00,stroke:#000
    style T fill:#00ff00,stroke:#000
```

### Descrição Detalhada:

1. **Selecionar Eventos**: Filtro por período, operação, tipo
2. **Agregar Eventos**: Somar valores por categoria
3. **Calcular Receita Bruta**: Σ de todos os eventos
4. **Aplicar Deduções**: Taxas, impostos, chargebacks, estornos
5. **Calcular Receita Líquida**: Receita Bruta - Deduções
6. **Carregar Matriz**: Buscar matriz ativa para o período
7. **Verificar Versão**: Garantir que a versão está correta
8. **Aplicar Percentuais**: Calcular distribuição inicial
9. **Aplicar Pisos e Tetos**: Ajustar valores conforme limites
10. **Ajustar para 100%**: Redistribuir excessos/deficiências
11. **Calcular Valor Líquido**: Receita Líquida - Reservas
12. **Gerar Calculation**: Criar entidade com todos os dados
13. **Calcular Hash**: SHA-256 do payload canônico
14. **Armazenar**: Persistir no banco de dados
15. **Criar Trilha**: Registrar ação na audit trail

---

## 3. Fluxo de Aprovação de Cálculo

```mermaid
graph TD
    A[Início] --> B[Criar Calculation DRAFT]
    B --> C[Operador Submete para Revisão]
    C --> D[Status: PENDING_REVIEW]
    D --> E[Revisão Técnica Inicial]
    E --> F{Validação OK?}
    F -->|Sim| G[Status: PENDING_APPROVAL]
    F -->|Não| H[Status: REJECTED]
    H --> I[Notificar Operador]
    I --> J[Permitir Resubmissão]
    J --> B
    G --> K[Aprovador Técnico Revisa]
    K --> L{Aprovação Técnica OK?}
    L -->|Sim| M[Status: PENDING_BUSINESS_APPROVAL]
    L -->|Não| H
    M --> N[Aprovador Comercial Revisa]
    N --> O{Aprovação Comercial OK?}
    O -->|Sim| P[Status: PENDING_FINANCIAL_APPROVAL]
    O -->|Não| H
    P --> Q[Controller Revisa]
    Q --> R{Aprovação Financeira OK?}
    R -->|Sim| S[Status: PENDING_COMPLIANCE_APPROVAL]
    R -->|Não| H
    S --> T[Compliance Officer Revisa]
    T --> U{Aprovação Compliance OK?}
    U -->|Sim| V[Status: APPROVED]
    U -->|Não| H
    V --> W[Gerar Instruções de Liquidação]
    W --> X[Status: SETTLEMENT_GENERATED]
    X --> Y[Fim]
    
    style A fill:#00ff00,stroke:#000
    style Y fill:#00ff00,stroke:#000
    style H fill:#ff0000,stroke:#000
```

### Descrição Detalhada:

1. **Criar Calculation**: Operador cria cálculo em DRAFT
2. **Submeter para Revisão**: Operador envia para revisão inicial
3. **Revisão Técnica**: Verificar dados e cálculos
4. **Aprovação Técnica**: Validar aspectos técnicos
5. **Aprovação Comercial**: Validar alinhamento com negócio
6. **Aprovação Financeira**: Validar conformidade contábil
7. **Aprovação Compliance**: Validar conformidade regulatória
8. **Gerar Instruções**: Criar settlement instructions

**Segregação de Funções:**
- Operador de Cálculo ≠ Aprovador Técnico ≠ Aprovador Comercial ≠ Controller ≠ Compliance Officer

---

## 4. Fluxo de Liquidação

```mermaid
graph TD
    A[Início] --> B[Calculation APPROVED]
    B --> C[Gerar Settlement Instructions]
    C --> D[Para cada Participante]
    D --> E[Criar Instrução]
    E --> F[Validar Dados da Instrução]
    F --> G{Validação OK?}
    G -->|Sim| H[Assinar Digitalmente]
    G -->|Não| I[Registrar Erro]
    I --> J[Notificar Operadores]
    J --> K[Fim com Erro]
    H --> L[Enviar para LOWDATAESC]
    L --> M[Status: PENDING]
    M --> N[LOWDATAESC Processa]
    N --> O[Status: PROCESSING]
    O --> P{Transferência OK?}
    P -->|Sim| Q[Status: COMPLETED]
    P -->|Não| R[Status: FAILED]
    R --> S[Contador de Tentativas < 5?]
    S -->|Sim| T[Retry com Backoff]
    S -->|Não| U[Notificar Operadores]
    T --> L
    U --> V[Fim com Erro]
    Q --> W[Atualizar Calculation]
    W --> X[Verificar Todas Instruções COMPLETED]
    X -->|Sim| Y[Calculation: COMPLETED]
    X -->|Não| Z[Aguardar Instruções Pendentes]
    Z --> W
    Y --> AA[Gerar Proof Bundle]
    AA --> AB[Fim]
    
    style A fill:#00ff00,stroke:#000
    style AB fill:#00ff00,stroke:#000
    style K fill:#ff0000,stroke:#000
    style V fill:#ff0000,stroke:#000
```

### Descrição Detalhada:

1. **Calculation Aprovado**: Todas as aprovações obtidas
2. **Gerar Instruções**: Criar uma instrução por participante
3. **Validar Instrução**: Verificar dados (valor, destino, moeda)
4. **Assinar Digitalmente**: Assinatura com chave privada
5. **Enviar para LOWDATAESC**: Chamada gRPC com mTLS
6. **Processamento**: LOWDATAESC reserva e transfere valores
7. **Retry**: Até 5 tentativas com backoff exponencial
8. **Atualizar Calculation**: Marcar como SETTLEMENT_GENERATED
9. **Verificar Completude**: Todas as instruções devem estar COMPLETED
10. **Gerar Proof Bundle**: Pacote de auditoria

---

## 5. Fluxo de Reconciliação

```mermaid
graph TD
    A[Início] --> B[Selecionar Período]
    B --> C[Buscar Eventos de Receita]
    C --> D[Buscar Settlement Instructions]
    D --> E[Buscar Confirmações de Liquidação]
    E --> F[Agregar por Moeda e Operação]
    F --> G[Calcular Totais de Eventos]
    G --> H[Calcular Totais de Liquidações]
    H --> I[Comparar Totais]
    I --> J{Diferença > Tolerância?}
    J -->|Não| K[Status: COMPLETED]
    J -->|Sim| L[Identificar Divergências]
    L --> M[Classificar Divergências]
    M --> N[Para cada Divergência]
    N --> O{Tipo de Divergência?}
    O -->|Evento sem Liquidação| P[Verificar Status do Evento]
    O -->|Liquidação sem Evento| Q[Verificar Origem da Liquidação]
    O -->|Valor Diferente| R[Verificar Cálculo e Matriz]
    O -->|Moeda Diferente| S[Verificar Conversão]
    P --> T[Registrar Divergência]
    Q --> T
    R --> T
    S --> T
    T --> U[Agregar Divergências]
    U --> V[Gerar Relatório de Divergências]
    V --> W[Notificar Financeiro e Compliance]
    W --> X[Escalar para Investigação]
    X --> Y[Bloquear Novas Liquidações?]
    Y -->|Sim| Z[Bloquear e Investigar]
    Y -->|Não| AA[Monitorar]
    Z --> AB[Fim com Ação]
    AA --> AB
    K --> AB
    
    style A fill:#00ff00,stroke:#000
    style AB fill:#00ff00,stroke:#000
    style Z fill:#ff0000,stroke:#000
```

### Descrição Detalhada:

1. **Selecionar Período**: Diário (automático) ou customizado
2. **Buscar Eventos**: Todos os eventos do período
3. **Buscar Liquidações**: Todas as instruções do período
4. **Agregar**: Por moeda e operação para comparar
5. **Calcular Totais**: Somar valores de eventos e liquidações
6. **Comparar**: Verificar se a diferença está dentro da tolerância (0.01%)
7. **Identificar Divergências**: Classificar por tipo
8. **Gerar Relatório**: Detalhar todas as divergências
9. **Notificar**: Enviar alerta para financeiro e compliance
10. **Escalar**: Iniciar investigação se necessário
11. **Bloquear**: Decisão de bloquear novas liquidações

**Tolerância**: Configurável por operação (default: 0.01%)

---

## 6. Fluxo de Gerenciamento de Disputas

```mermaid
graph TD
    A[Início] --> B[Participante Abre Disputa]
    B --> C[Preencher Formulário]
    C --> D[Enviar com Evidências]
    D --> E[Validar Dados da Disputa]
    E --> F{Dados Válidos?}
    F -->|Sim| G[Criar Disputa]
    F -->|Não| H[Retornar Erro]
    H --> I[Fim com Erro]
    G --> J[Status: OPEN]
    J --> K[Notificar Time de Operações]
    K --> L[Analisar Disputa]
    L --> M[Classificar por Tipo]
    M --> N{Cálculo Incorreto?}
    N -->|Sim| O[Verificar Cálculo]
    N -->|Não| P[Matriz Errada?]
    P -->|Sim| Q[Verificar Matriz]
    P -->|Não| R[Evento Não Reconhecido?]
    R -->|Sim| S[Verificar Origem do Evento]
    R -->|Não| T[Liquidação Não Recebida?]
    T -->|Sim| U[Verificar Status no LOWDATAESC]
    T -->|Não| V[Outro Motivo]
    O --> W[Recalcular]
    Q --> X[Corrigir Matriz]
    S --> Y[Investigar Evento]
    U --> Z[Investigar Liquidação]
    V --> AA[Investigar Motivo]
    W --> AB[Gerar Novo Cálculo]
    X --> AB
    Y --> AB
    Z --> AB
    AA --> AB
    AB --> AC[Enviar para Aprovação]
    AC --> AD[Aguardar Aprovações]
    AD --> AE{Aprovado?}
    AE -->|Sim| AF[Status: RESOLVED]
    AE -->|Não| AG[Status: REJECTED]
    AF --> AH[Notificar Participante]
    AG --> AH
    AH --> AI[Arquivar Disputa]
    AI --> AJ[Fim]
    
    style A fill:#00ff00,stroke:#000
    style AJ fill:#00ff00,stroke:#000
    style I fill:#ff0000,stroke:#000
```

### Descrição Detalhada:

1. **Abrir Disputa**: Participante submete disputa via API ou interface
2. **Preencher Formulário**: Dados da disputa e evidências
3. **Validar**: Verificar campos obrigatórios e formatação
4. **Criar Disputa**: Persistir com status OPEN
5. **Notificar**: Alertar time de operações
6. **Analisar**: Classificar por tipo de problema
7. **Investigar**: Verificar cálculo, matriz, evento ou liquidação
8. **Recalcular/Corrigir**: Ajustar conforme necessário
9. **Aprovação**: Novo workflow de aprovação para o cálculo corrigido
10. **Resolução**: Atualizar status e notificar participante

**SLA**: 5 dias úteis para resolução

---

## 7. Fluxo de Versionamento de Matriz

```mermaid
graph TD
    A[Início] --> B[Solicitar Nova Versão]
    B --> C[Preencher Justificativa]
    C --> D[Enviar para Aprovação]
    D --> E[Status: DRAFT]
    E --> F[Compliance Revisa]
    F --> G{Conformidade OK?}
    G -->|Sim| H[Status: PENDING_APPROVAL]
    G -->|Não| I[Retornar para Correção]
    I --> B
    H --> J[Jurídico Revisa]
    J --> K{Contrato OK?}
    K -->|Sim| L[Status: APPROVED]
    K -->|Não| I
    L --> M[Definir Data de Vigência]
    M --> N[Notificar Participantes]
    N --> O[Publicar Nova Versão]
    O --> P[Status: ACTIVE]
    P --> Q[Arquivar Versão Anterior]
    Q --> R[Fim]
    
    style A fill:#00ff00,stroke:#000
    style R fill:#00ff00,stroke:#000
    style I fill:#ff0000,stroke:#000
```

### Descrição Detalhada:

1. **Solicitar**: Operador ou participante solicita nova versão
2. **Justificativa**: Motivo para a mudança (novo participante, ajuste de percentuais, etc.)
3. **Revisão Compliance**: Verificar conformidade regulatória
4. **Revisão Jurídica**: Verificar conformidade contratuais
5. **Aprovação**: Assinaturas digitais de todas as partes
6. **Data de Vigência**: Definir quando a nova versão entra em vigor
7. **Notificação**: Comunicar todos os participantes
8. **Publicação**: Tornar a versão ativa no sistema
9. **Arquivamento**: Manter versão anterior para auditabilidade

---

## 8. Fluxo de Resposta a Incidentes

```mermaid
graph TD
    A[Início] --> B[Detectar Incidente]
    B --> C[Classificar Severidade]
    C --> D{Crítico?}
    D -->|Sim| E[Ativar Time de Plantão]
    D -->|Alto| F[Notificar Time de Operações]
    D -->|Médio/Baixo| G[Registrar e Monitorar]
    E --> H[Isolar Sistema Afetado]
    H --> I[Contenção Imediata]
    I --> J[Identificar Causa Raiz]
    J --> K[Desenvolver Solução]
    K --> L[Testar Solução]
    L --> M[Implementar Solução]
    M --> N[Verificar Resolução]
    N --> O{Resolvido?}
    O -->|Sim| P[Comunicar Resolução]
    O -->|Não| K
    P --> Q[Documentar Post-Mortem]
    Q --> R[Revisar com Time]
    R --> S[Atualizar Runbook]
    S --> T[Fim]
    F --> H
    G --> J
    
    style A fill:#00ff00,stroke:#000
    style T fill:#00ff00,stroke:#000
    style E fill:#ff0000,stroke:#000
```

### Descrição Detalhada:

1. **Detectar**: Monitoramento ou relatório de usuário
2. **Classificar**: Crítico (downtime), Alto (degradação), Médio/Baixo (avisos)
3. **Ativar Time**: Plantão 24/7 para críticos
4. **Isolar**: Evitar impacto em outros sistemas
5. **Contenção**: Minimizar danos
6. **Investigar**: Encontrar causa raiz
7. **Solução**: Desenvolver e testar correção
8. **Implementar**: Deploy da solução
9. **Verificar**: Confirmar que o problema foi resolvido
10. **Documentar**: Post-mortem com lições aprendidas
11. **Revisar**: Ajustar runbooks e procedimentos

**SLA de Resposta:**
- Crítico: < 15 minutos
- Alto: < 1 hora
- Médio: < 4 horas
- Baixo: < 24 horas

---

## 9. Legenda

| Cor | Significado |
|-----|-------------|
| Verde (#00ff00) | Início/Fim |
| Vermelho (#ff0000) | Erro/Falha |
| Amarelo (#ffff00) | Aviso (opcional) |
| Azul (#0000ff) | Processo (opcional) |

| Forma | Significado |
|-------|-------------|
| Retângulo | Processo/Atividade |
| Losango | Decisão |
| Oval | Início/Fim |

---

## 10. Ferramentas para Visualização

Para visualizar os fluxogramas interativamente:

1. **Mermaid Live Editor**: https://mermaid.live
   - Copiar o código mermaid e colar no editor
   - Visualização interativa com zoom e pan

2. **VS Code com extensão Mermaid**:
   - Instalar extensão "Mermaid Preview"
   - Abrir arquivo .mmd ou .md com código mermaid
   - Visualizar diretamente no editor

3. **GitHub**:
   - Fluxogramas mermaid são renderizados automaticamente em arquivos .md

4. **Diagrams.net**:
   - Importar código mermaid
   - Editar e exportar para vários formatos

---

**Versão:** 1.0.0  
**Data:** 2024-11-02  
**Responsável:** Arquitetura LOWDATAESC
