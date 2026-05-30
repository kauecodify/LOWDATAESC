<img width="500" height="500" alt="lowdataesc" src="https://github.com/user-attachments/assets/ec9254b9-f4eb-40ff-abdd-343950260609" />

# MVP - LOWDATAESC 🇧🇷

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

🎯 CHECKLIST VALUE

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

