# Bot Telegram + Google Sheets (Framework Configurable)

## Descripcion

**Framework configurable** de bot de Telegram deployado en **AWS Lambda** ($0 de costo) que recibe mensajes de texto y audio, usa **Groq AI** con fallback automatico entre modelos para extraer datos estructurados, y los registra en **Google Sheets**.

El bot es **conversacional**: si la IA no puede extraer todos los campos requeridos de un solo mensaje, le pregunta al usuario por los datos faltantes. Todo el comportamiento se define en un **unico archivo de configuracion** (`src/config/bot-config.ts`).

### Caso de uso incluido: Registro de ventas

La config de ejemplo registra ventas en una hoja "Ventas" con las columnas:

| Fecha | Clienta/e | Prendas | Monto $ | Tipo Pago |
|---|---|---|---|---|
| 2025-01-15 | María | Remera negra + Jean | 45000 | Efectivo |

El usuario le manda al bot algo como _"María compró una remera y un jean por 45 lucas en efectivo"_ y el bot extrae todo automaticamente.

## Arquitectura

```
Usuario (Telegram)
    |
    | HTTPS POST (webhook)
    v
API Gateway (AWS) ────> AWS Lambda (Node.js 20)
                            |
                            v
                      grammY Bot Router
                            |
              ┌─────────────┼──────────────────┐
              v             v                  v
        Groq AI        Groq AI          Google Sheets API
       (Whisper)    (LLM + Fallback)    (googleapis)
      Transcribe    Extract data         Append row
        audio       con Zod schema       Read/Write state
```

### Flujo detallado

1. Telegram envia un POST al webhook (API Gateway URL)
2. API Gateway forwardea a Lambda con el body como JSON string
3. `handler.ts` parsea el body y llama `bot.handleUpdate(update)`
4. El bot router verifica si hay **estado conversacional** (datos parciales de mensajes anteriores)
5. **Texto**: se manda a Groq LLM para extraer los campos definidos en la config
6. **Audio**: se descarga → transcribe con Groq Whisper → se extrae como texto
7. Si la IA extrae **todos los campos requeridos** → se appendea la fila a Google Sheets y se confirma
8. Si **faltan campos** y la config tiene `askForMissing: true` → se guarda el estado parcial en una hoja oculta (`_state`) y se le pregunta al usuario por los faltantes
9. El estado conversacional tiene un **TTL configurable** (default: 5 minutos). Despues expira y se empieza de cero.

## Como funciona la configuracion

Todo el comportamiento del bot se define en `src/config/bot-config.ts`. Para crear tu propio bot:

1. **Define las columnas** con nombre, tipo, si son requeridas, y si tienen autoFill (ej: fecha actual)
2. **Configura los modelos de IA** en orden de preferencia (fallback automatico si un modelo falla)
3. **Ajusta los mensajes** de confirmacion, error, y solicitud de datos faltantes
4. **Configura la conversacion** (TTL, si pedir datos faltantes o usar defaults)

```typescript
// src/config/bot-config.ts
export const botConfig: BotConfig = {
  sheets: [{
    name: 'Ventas',
    columns: [
      { name: 'Fecha', type: 'date', required: true, autoFill: 'currentDate' },
      { name: 'Clienta/e', type: 'string', required: true },
      { name: 'Prendas', type: 'string', required: true },
      { name: 'Monto $', type: 'number', required: true },
      { name: 'Tipo Pago', type: 'string', required: false },
    ],
  }],
  ai: {
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'gemma2-9b-it',
    ],
    temperature: 0.1,
  },
  conversation: {
    askForMissing: true,
    ttlSeconds: 300,
  },
};
```

## Stack tecnologico

| Componente | Tecnologia |
|---|---|
| Runtime | Node.js 20 |
| Lenguaje | TypeScript (strict mode) |
| Bot framework | [grammY](https://grammy.dev/) v1.21 |
| AI - Transcripcion | Vercel AI SDK v4 + Groq Whisper (`whisper-large-v3-turbo`) |
| AI - Extraccion | Vercel AI SDK v4 + Groq LLM (con fallback entre modelos) |
| Google Sheets | `googleapis` v144 (cliente oficial de Google) |
| Validacion | Zod v3 (config schema + dynamic extraction schema) |
| Estado conversacional | Google Sheets (hoja oculta `_state`, con TTL) |
| Infra | AWS Lambda + API Gateway via Terraform |
| Bundler | esbuild (custom build script) |
| Package manager | pnpm |
| Dev tools | tsx (para scripts locales) |

## Estructura del proyecto

```
bot-telegram-google-sheets/
├── src/
│   ├── handler.ts              # Entry point de Lambda. Parsea body de API Gateway.
│   ├── config.ts               # Validacion de env vars (secrets) con Zod.
│   ├── config/
│   │   ├── bot-config.schema.ts  # [CORE] Schema Zod del framework (columnas, AI, mensajes)
│   │   ├── bot-config.ts         # [EDITAR] EL archivo que personalizas para tu caso de uso
│   │   ├── helpers.ts            # Auto-genera: Zod schema de extraccion, system prompt, row builder
│   │   └── index.ts              # Barrel con validacion al importar
│   ├── ai/
│   │   ├── extract.ts          # Extraccion generica con fallback secuencial entre modelos
│   │   ├── transcribe.ts       # Transcripcion de audio con Groq Whisper
│   │   └── index.ts            # Barrel
│   ├── sheets/
│   │   ├── client.ts           # Singleton del cliente googleapis con JWT auth
│   │   ├── operations.ts       # CRUD generico: appendRow, readRows, deleteRow
│   │   └── index.ts            # Barrel
│   ├── state/
│   │   └── index.ts            # Estado conversacional en hoja oculta _state (con TTL)
│   └── bot/
│       └── index.ts            # Orquestador: AI → state → sheets → confirmacion
├── scripts/
│   ├── set-webhook.ts          # Configura webhook de Telegram
│   ├── server.ts               # Servidor Express local para desarrollo
│   ├── test-local.ts           # Tests manuales
│   └── debug-sheets.ts         # Debug: muestra contenido de hojas
├── terraform/
│   ├── main.tf                 # Provider AWS
│   ├── lambda.tf               # Lambda + API Gateway
│   ├── iam.tf                  # IAM role
│   ├── variables.tf            # Variables Terraform
│   ├── outputs.tf              # URL del endpoint
│   ├── terraform.tfvars.example    # Template (copiar a terraform.tfvars)
│   ├── google-credentials.json.example  # Template de credenciales Google
│   └── README.md               # Documentacion de Terraform
├── build.mjs                   # esbuild + plugin native-fetch (CRITICO para Lambda)
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md                   # Este archivo
```

## Requisitos previos

- **Node.js 20+** (IMPORTANTE: tiene que ser 20+ por el native fetch)
- **pnpm** (package manager)
- **AWS CLI** configurado (`aws configure`)
- **Terraform** >= 1.0
- **Cuenta de Groq** ([console.groq.com](https://console.groq.com/))
- **Proyecto en Google Cloud** con la Google Sheets API habilitada
- **Bot de Telegram** creado via [@BotFather](https://t.me/BotFather)
- **Google Spreadsheet** con los headers de tu config (ver paso 3)

## Setup paso a paso

### 1. Clonar e instalar

```bash
git clone <url-del-repo>
cd bot-telegram-google-sheets
pnpm install
```

### 2. Configurar credenciales

Hay **5 credenciales** que necesitas:

#### 2.1 Telegram Bot Token

- **Donde obtenerlo**: [@BotFather](https://t.me/BotFather) → `/newbot`
- **Donde ponerlo**: `terraform/terraform.tfvars` → `telegram_bot_token`
- **IMPORTANTE**: Tambien necesitas el `botInfo` hardcodeado en `src/bot/index.ts`. Hace un GET a `https://api.telegram.org/bot<TU_TOKEN>/getMe` y copia los datos.

#### 2.2 Groq API Key

- **Donde obtenerla**: [console.groq.com](https://console.groq.com/) → API Keys
- **Donde ponerla**: `terraform/terraform.tfvars` → `groq_api_key`

#### 2.3 Google Service Account

1. [Google Cloud Console](https://console.cloud.google.com/) → proyecto
2. Habilita **Google Sheets API** (APIs & Services > Library)
3. **IAM & Admin > Service Accounts** → crear
4. Generar key JSON → descargar
5. Copiar a `terraform/google-credentials.json`

```bash
cd terraform
cp google-credentials.json.example google-credentials.json
# Pega el contenido real del JSON
```

#### 2.4 Spreadsheet ID

Lo sacas de la URL del Google Sheet:
```
https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit
                                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```
Ponerlo en: `terraform/terraform.tfvars` → `spreadsheet_id`

#### 2.5 Webhook Secret

Cualquier string random:
```bash
openssl rand -hex 32
```
Ponerlo en: `terraform/terraform.tfvars` → `webhook_secret`

#### Resumen: crear terraform.tfvars

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Editar con tus valores:

```hcl
aws_region         = "us-east-1"
telegram_bot_token = "tu_token"
webhook_secret     = "un_string_random_largo"
groq_api_key       = "gsk_tu_api_key"
spreadsheet_id     = "tu_spreadsheet_id"
```

### 3. Configurar Google Sheets

Crea una hoja con los headers que matcheen tu config. Para el ejemplo de ventas:

#### Hoja "Ventas"

| Fecha | Clienta/e | Prendas | Monto $ | Tipo Pago |
|---|---|---|---|---|
| | | | | |

La primera fila son los headers. El bot appendea datos a partir de la fila 2.

La hoja oculta `_state` se crea automaticamente la primera vez que el bot necesita guardar estado conversacional.

#### COMPARTIR CON EL SERVICE ACCOUNT

**CRITICO** (se olvida siempre):

1. Abri `terraform/google-credentials.json`
2. Busca el campo `client_email`
3. En el Google Sheet → Compartir → Agregar ese email como **Editor**

Sin esto, el bot tira error 403.

### 4. Build

```bash
pnpm build
```

Ejecuta `build.mjs` con esbuild → produce `dist/handler.js` (CJS, target Node 20).

### 5. Deploy con Terraform

```bash
cd terraform
terraform init      # Solo la primera vez
terraform plan      # Ver cambios
terraform apply     # Aplicar
```

Terraform crea: Lambda (512MB, 60s timeout) + API Gateway (`/webhook` POST) + IAM role + env vars.

### 6. Configurar webhook de Telegram

```bash
# Opcion A: script incluido (necesita .env con TELEGRAM_BOT_TOKEN y WEBHOOK_SECRET)
npx tsx scripts/set-webhook.ts https://xxx.execute-api.us-east-1.amazonaws.com/prod/webhook

# Opcion B: curl directo
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://xxx.execute-api.us-east-1.amazonaws.com/prod/webhook", "secret_token": "<SECRET>"}'

# Verificar
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

### 7. Deploy rapido (solo codigo)

```bash
# Windows (PowerShell)
pnpm build && powershell -Command "Compress-Archive -Path dist/handler.js -DestinationPath dist/lambda.zip -Force" && aws lambda update-function-code --function-name telegram-bot-sheets --zip-file fileb://dist/lambda.zip

# Linux/Mac
pnpm build && cd dist && zip lambda.zip handler.js && cd .. && aws lambda update-function-code --function-name telegram-bot-sheets --zip-file fileb://dist/lambda.zip
```

## Como personalizar el bot

Para adaptar el bot a **tu caso de uso** (ej: gastos, inventario, leads, etc.):

1. **Edita `src/config/bot-config.ts`**:
   - Cambia el nombre de la hoja y las columnas
   - Ajusta que campos son requeridos, tipos, y autoFill
   - Personaliza los mensajes de confirmacion/error
   - Elige los modelos de IA en orden de preferencia

2. **Crea la hoja en Google Sheets** con headers que matcheen los `name` de tus columnas

3. **Build + deploy** (ver paso 7)

### Tipos de columna soportados

| Tipo | Descripcion |
|---|---|
| `string` | Texto libre |
| `number` | Numero (la IA extrae el valor numerico) |
| `date` | Fecha (formato configurable) |
| `enum` | Valor de una lista predefinida (ej: "Efectivo", "Transferencia") |

### AutoFill

| Valor | Que hace |
|---|---|
| `currentDate` | Llena automaticamente con la fecha actual |
| `currentDateTime` | Llena con fecha y hora actual |

### Fallback de modelos

Si un modelo de Groq falla (429 rate limit, 503 overloaded, timeout), el bot automaticamente intenta con el siguiente modelo de la lista. Ejemplo de config:

```typescript
ai: {
  models: [
    'llama-3.3-70b-versatile',    // Mejor calidad, pero rate-limited
    'llama-3.1-8b-instant',       // Rapido y confiable
    'gemma2-9b-it',               // Fallback final
  ],
}
```

### Flujo conversacional

Si `conversation.askForMissing` es `true`, cuando faltan campos el bot:
1. Guarda los datos parciales en la hoja oculta `_state`
2. Le pregunta al usuario por los campos faltantes
3. Cuando el usuario responde, combina los datos nuevos con los guardados
4. Si tiene todos los campos requeridos → appendea la fila
5. El estado expira despues de `ttlSeconds` (default: 300s = 5 min)

## Scripts de desarrollo

| Comando | Que hace |
|---|---|
| `pnpm build` | Bundlea con esbuild a `dist/handler.js` |
| `pnpm dev:server` | Servidor Express local en puerto 3000 |
| `pnpm test-local` | Tests manuales: AI + Sheets + flujo completo |
| `pnpm debug-sheets` | Muestra contenido de las hojas |

Para scripts locales, crea `.env` en la raiz:

```env
TELEGRAM_BOT_TOKEN=tu_token
WEBHOOK_SECRET=tu_secret
GROQ_API_KEY=gsk_xxx
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
SPREADSHEET_ID=tu_spreadsheet_id
```

**NOTA**: `GOOGLE_SERVICE_ACCOUNT_JSON` va todo en una sola linea como JSON stringificado.

## Variables de entorno

| Variable | Descripcion | Donde se configura |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram | `terraform.tfvars` |
| `WEBHOOK_SECRET` | Secret para verificar webhook | `terraform.tfvars` |
| `GROQ_API_KEY` | API key de Groq | `terraform.tfvars` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JSON del Service Account de Google | `terraform/google-credentials.json` |
| `SPREADSHEET_ID` | ID del Google Spreadsheet | `terraform.tfvars` |

## Costos

| Servicio | Costo |
|---|---|
| AWS Lambda | $0 (free tier: 1M invocaciones/mes) |
| API Gateway | $0 (free tier: 1M llamadas/mes por 12 meses) |
| Groq AI | $0 (free tier generoso) |
| Google Sheets API | $0 |
| Telegram Bot API | $0 |

**Costo total: $0** para uso personal o bajo trafico.

## Gotchas y problemas conocidos

### 1. grammY + esbuild + Lambda: node-fetch

grammY usa `node-fetch` internamente. En Node 20+ ya existe `fetch` nativo. `build.mjs` tiene un plugin que reemplaza `node-fetch` con los globals nativos. **NO marques `node-fetch` como `external`** en esbuild.

### 2. bot.init() causa timeout en Lambda

Pasar `botInfo` estatica en el constructor del Bot para evitar que grammY haga un GET a Telegram en cada cold start. Obtener los datos via `getMe`.

### 3. API Gateway vs Function URL

NO usar `webhookCallback()` de grammY. Parsear el body manualmente en `handler.ts` porque API Gateway manda el body como JSON string.

### 4. Corrupcion de credenciales Google

Si la private key en `google-credentials.json` se trunca → error `ERR_OSSL_UNSUPPORTED`. Verificar que la key empiece con `-----BEGIN PRIVATE KEY-----` y termine con `-----END PRIVATE KEY-----\n`.

### 5. Lambda container reuse

Despues de deployar, Lambda puede seguir usando containers viejos. Buscar `INIT_START` en CloudWatch para confirmar que se inicio un container nuevo.

### 6. googleapis vs google-spreadsheet

Se usa `googleapis` (cliente oficial). El wrapper `google-spreadsheet` tenia problemas de auth en Lambda.

### 7. Variables de entorno en Terraform

Las credenciales Google se cargan con `file()` de Terraform como env var. Limite de 4KB total para env vars de Lambda (en la practica sobra).

### 8. Instancia del bot fuera del handler

El bot se crea **una sola vez** fuera del handler de Lambda para aprovechar container reuse. Lo mismo el cliente de Google Sheets.

## Licencia

MIT
