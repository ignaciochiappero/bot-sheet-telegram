# Terraform - Infraestructura AWS

Este directorio contiene la configuracion de Terraform para deployar el bot de Telegram en AWS Lambda + API Gateway.

## Requisitos previos

- [Terraform](https://developer.hashicorp.com/terraform/downloads) instalado
- [AWS CLI](https://aws.amazon.com/cli/) configurado con tus credenciales (`aws configure`)
- Una cuenta de [Google Cloud](https://console.cloud.google.com/) con un Service Account
- Un bot de Telegram creado via [@BotFather](https://t.me/BotFather)
- Una API key de [Groq](https://console.groq.com/)

## Archivos que tenes que crear

Hay dos archivos que necesitas crear a partir de sus `.example`:

### 1. `terraform.tfvars`

```bash
cp terraform.tfvars.example terraform.tfvars
```

Abri `terraform.tfvars` y reemplaza los valores:

| Variable             | Donde obtenerla                                                                 |
| -------------------- | ------------------------------------------------------------------------------- |
| `telegram_bot_token` | Habla con [@BotFather](https://t.me/BotFather) en Telegram y crea un bot       |
| `webhook_secret`     | Inventalo vos, cualquier string random (ej: `openssl rand -hex 32`)            |
| `groq_api_key`       | Registrate en [console.groq.com](https://console.groq.com/) y crea una API key |
| `spreadsheet_id`     | Esta en la URL de tu Google Sheet: `docs.google.com/spreadsheets/d/{ESTE_ID}/` |
| `aws_region`         | Dejalo en `us-east-1` salvo que necesites otra region                           |

### 2. `google-credentials.json`

```bash
cp google-credentials.json.example google-credentials.json
```

Para obtener las credenciales reales:

1. Anda a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto (o usa uno existente)
3. Habilita la **Google Sheets API**
4. Anda a **IAM & Admin > Service Accounts**
5. Crea un Service Account
6. En la pestaña **Keys**, genera una nueva key en formato JSON
7. Descarga el archivo y reemplaza el contenido de `google-credentials.json` con ese JSON
8. Comparti tu Google Sheet con el email del Service Account (`client_email` del JSON)

## Deploy

```bash
# Inicializar Terraform (solo la primera vez)
terraform init

# Ver que cambios se van a aplicar
terraform plan

# Aplicar los cambios
terraform apply
```

Despues del `apply`, Terraform te muestra la URL del API Gateway. Usa esa URL para configurar el webhook del bot.

## Deploy rapido (solo actualizar codigo)

Si solo cambiaste codigo TypeScript y no la infraestructura:

```bash
pnpm build && powershell -Command "Compress-Archive -Path dist/handler.js -DestinationPath dist/lambda.zip -Force" && aws lambda update-function-code --function-name telegram-bot-sheets --zip-file fileb://dist/lambda.zip
```

## IMPORTANTE

**NUNCA commitees estos archivos al repositorio:**

- `terraform.tfvars` (contiene API keys y tokens)
- `google-credentials.json` (contiene la private key de Google)
- `*.tfstate` (contiene el estado de la infra, puede exponer secretos)

Ya estan en el `.gitignore`, pero si alguna vez los ves en `git status` como tracked, sacalos con:

```bash
git rm --cached terraform/terraform.tfvars
git rm --cached terraform/google-credentials.json
```
