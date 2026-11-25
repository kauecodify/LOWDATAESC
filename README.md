<img width="500" height="500" alt="lowdataesc" src="https://github.com/user-attachments/assets/ec9254b9-f4eb-40ff-abdd-343950260609" />

# MVP - LOWDATAESC 🇧🇷

# SITE > https://lowdataesc.netlify.app

## Plataforma de Dados Escalonados com Custódia Inteligente (Escrow)

### Visão Geral

A LOWDATAESC é uma plataforma de armazenamento e monetização de dados estruturados, projetada para grandes empresas, fundos de investimento e instituições financeiras que necessitam de:

* Segurança máxima de ativos digitais;
* Custódia segregada em contas escrow;
* Rastreabilidade completa das operações;
* Rendimentos diários provenientes da utilização controlada dos dados;
* Governança corporativa e compliance avançado.
* apenas transações homologadas entre sócios ou contas agregadas no terminal

A arquitetura foi desenvolvida sob o princípio **Zero Trust Security**, garantindo que nenhuma operação seja executada sem validações sucessivas de identidade, dispositivo, comportamento e autorização.

---

# Arquitetura de Segurança

## Camada 1 — Validação de Identidade

Antes de qualquer movimentação financeira ou operacional, o usuário passa por:

### KYC Corporativo

* Validação documental;
* Verificação de representantes legais;
* Consulta antifraude;
* Validação cadastral empresarial.

### Biometria Facial

Cada acesso crítico exige:

* Reconhecimento facial em tempo real;
* Verificação de prova de vida (Liveness Detection);
* Comparação biométrica com cadastro homologado. (anatel e serasa)

---

## Camada 2 — Registro de Dispositivo

Cada dispositivo autorizado recebe um identificador criptográfico único.

Elementos analisados:

* Hardware ID;
* Assinatura criptográfica do aparelho;
* Device Fingerprint;
* Geolocalização autorizada;
* Histórico de utilização.

O dispositivo passa a integrar uma lista segura de equipamentos confiáveis.

---

## Camada 3 — Inteligência Comportamental

A plataforma cria um perfil comportamental contínuo do usuário.

Exemplos monitorados:

* Velocidade de digitação;
* Padrão de toque;
* Horários de utilização;
* Localizações habituais;
* Sequência de navegação;
* Tempo médio entre ações.

Caso haja divergência significativa, a operação é automaticamente bloqueada.

---

## Camada 4 — Proteção Contra Perda ou Roubo

Se um dispositivo for perdido:

### O que acontece?

* Todas as permissões são suspensas;
* O Device Fingerprint é invalidado;
* Tokens de autenticação são revogados;
* Sessões ativas são encerradas;
* Operações financeiras ficam bloqueadas.

Mesmo que terceiros obtenham:

* Senha;
* Token;
* E-mail;

a plataforma continuará recusando transações devido à ausência do padrão comportamental previamente aprendido.

---

## Camada 5 — Motor Antifraude

O motor antifraude executa centenas de verificações em tempo real.

Entre elas:

* Score de risco;
* Correlação de identidade;
* Reputação do dispositivo;
* Análise geográfica;
* Detecção de VPN;
* Detecção de emuladores;
* Análise de comportamento anômalo.

## O Poder do AES-256

Combinações: Existem \(2^{256}\) chaves possíveis.

Número: Isso equivale a um 1 seguido de 77 zeros.

Tempo: Supercomputadores levariam bilhões de anos para adivinhar.

Energia: O processo exigiria mais energia do que o Sol produz.

---

## Camada 6 — Contas Escrow

Os ativos permanecem segregados em contas escrow.

Benefícios:

* Separação patrimonial;
* Proteção jurídica;
* Auditoria contínua;
* Transparência operacional;
* Governança institucional.

---

# Fluxo Operacional

1. Usuário solicita operação.
2. Sistema valida biometria facial.
3. Sistema valida dispositivo autorizado.
4. Sistema compara comportamento histórico.
5. Motor antifraude calcula risco.
6. Compliance verifica regras corporativas.
7. Operação é assinada digitalmente.
8. Registro é gravado em trilha imutável.
9. Transação é executada.
10. Auditoria registra o evento.

---

# Infraestrutura

## Front-End

* Html/css/javascript

## Back-End

* Node.js
* NestJS
* Python IA Services

## Banco de Dados

* PostgreSQL
* Redis
* Data Lake Distribuído

## Segurança

* AES-256
* TLS 1.3
* HSM
* MFA
* Device Fingerprint
* Biometria Facial
* Behavioral Analytics

## Observabilidade

* Prometheus
* Grafana
* ELK Stack


## 📁 - ESTRUTURA BACK/DATA/CI-CD

<img width="477" height="361" alt="image" src="https://github.com/user-attachments/assets/4780e753-2a98-4342-b59d-98eb22288e7a" />

## 🚀 DEPLOY

# 1. Setup Infra

cd infrastructure/terraform

terraform init && terraform plan -var-file=env/sa-east-1.tfvars

terraform apply -auto-approve

# 2. Build & Push Services

docker build -t lowdataesc/auth:${COMMIT} services/auth-service

docker push lowdataesc/auth:${COMMIT}

# 3. Deploy via Helm

helm upgrade --install lowdataesc ./infrastructure/helm/lowdataesc \

  --set image.tag=${COMMIT} --namespace production

# 4. Verify Health & Compliance

kubectl get pods -n production

curl http://localhost:3000/health

curl http://localhost:8080/audit/v1/log -d '{"event":"boot","service":"audit"}'


---

# Compliance

A plataforma foi projetada considerando:

* LGPD
* ISO 27001
* ISO 27701
* SOC 2
* Boas práticas de Open Finance

---

# Diferencial LOWDATAESC

✅ Dados escalonados de alta disponibilidade (serasa)

✅ Contas escrow segregadas

✅ Rendimentos diários

✅ Biometria facial contínua

✅ Inteligência comportamental

✅ Bloqueio automático de dispositivos comprometidos (anatel)

✅ Auditoria completa

✅ Segurança corporativa de nível institucional

---

## 🎯 CHECKLIST VALUE

Pilar,Status,Evidência no Código

Zero Trust,✅,"mTLS via SPIFFE, OPA guard, Vault integration"

Immutable Audit,✅,Rust service + S3 Object Lock + SHA-256

AI Explainability,✅,SHAP integration + Evidently drift monitor

LGPD/BCB Ready,✅,"DSR API, Consent Registry, Crypto-Wipe"

Load Tested,✅,"k6 pipeline (5k TPS, p95<100ms)"

Shift-Left Sec,✅,"Snyk, Trivy, OWASP ZAP no CI"

Multi-AZ/DR,✅,"Terraform RDS multi-az, Kafka mirror, Route53"

IP/Compliance Docs,,docs/threat-model.md", "compliance/iso27001-controls/

---

## Slogan

**LOWDATAESC**

*"Dados protegidos. Valor escalonado. Confiança institucional."*


---

# Modulo Divida Publica - Split Payment B2G

O modulo `dividapublica/` valida a operacao de Split Payment com Amortizacao Parcial da Divida Publica em Tempo Real lastreada em Titulos Publicos (fluxo D-0), com travas Zero Trust, custodia segregada escrow (Camada 6), trilha de auditoria SHA-256 encadeada e whitelabel B2G declarativo (`dividapublica/whitelabel/`). Documentacao tecnica em `dividapublica/README.md`.

## Manual de instalacao (modulo Divida Publica)

1. Instale Node.js 18 ou superior (recomendado 22 LTS).
2. Na raiz do repositorio, instale a toolchain fixada (unico passo de setup): `npm install`.
3. Execute a validacao E2E: `npx ts-node dividapublica/tests/validate-operation.ts` (ou `npm run validate:dividapublica`).
4. Resultado esperado: `VALIDACAO E2E COMPLETA: 30/30 validacoes OK, exit code 0`; qualquer trava violada retorna `exit code 1`.
5. Testes unitarios adicionais: `npm run test:money` (fuzz de conservacao de centavos) e `npm run test:dust` (conservacao do ledger de dust).

### Checklist Parte III (camada de controle exata) - status

| Item | Conteudo | Status |
|------|----------|--------|
| 1 | Invariantes I1-I8 formalizadas (`src/invariants.ts`) | Fechado |
| 2 | Fuzz 10.000 valores de conservacao (`tests/money.test.ts`, T13) | Fechado |
| 3 | Casos de borda (bruto 0/1, PU 1, PU > bruto, estoque exato, T29) | Fechado |
| 4 | Fronteira transacional via saga com compensacao (`src/saga.ts`) | Fechado |
| 5 | Injecao de falha sem estado orfao (T18, T19, journal de pendencias) | Fechado |
| 6 | Idempotencia sequencial e paralela (`src/idempotency.ts`, T15, T16) | Fechado |
| 7 | Replay adversarial com key estavel (T17) | Fechado |
| 8 | Canonicalizacao C1-C5 (`src/canonical.ts`) | Fechado |
| 9 | Recomputacao cega do selo (T21) | Fechado |
| 10 | Sensibilidade de 1 bit / tamper isolado (T20, T22) | Fechado |
| 11 | Ancora externa anti-reescrita (`src/anchor.ts`, T23, T24) | Fechado |
| 12 | Conciliacao diaria R1-R7 (`src/reconcile.ts`, T25, T26) | Fechado |
| 13 | Integracao real (Selic/STN, HSM, publicacao DOU) | Aberto - fora do escopo |

Relatorio de aceitacao completo: `dividapublica/docs/RELATORIO-CAMADA-CONTROLE.md`.

O codigo do modulo nao tem dependencias de runtime; o `package.json` da raiz fixa apenas `ts-node` e `typescript` para execucao tipada.
