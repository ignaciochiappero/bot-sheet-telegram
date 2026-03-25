# Bot Telegram + Google Sheets

## Descripcion

Bot de Telegram deployado en **AWS Lambda** que recibe mensajes de texto y audio, usa **Groq AI** (LLM para extraccion de productos, Whisper para transcripcion de audio) y actualiza un **Google Sheets** marcando productos como vendidos y registrando ventas automaticamente.

El usuario le manda un mensaje al bot tipo _"Quiero comprar unas zapatillas"_, el bot extrae el nombre del producto con IA, busca ese producto en la hoja de stock, lo marca como "Vendido" y registra la venta en otra hoja con fecha y precio.

## Arquitectura

```
Usuario (Telegram)
    |
    | HTTPS POST (webhook)
    v
API Gateway (AWS) ──── /webhook (POST) ────> AWS Lambda (Node.js 20)
                                                  |
                                                  v
                                            grammY Bot
                                                  |
                                    ┌─────────────┼─────────────┐
                                    v             v              v
                              Groq AI        Groq AI      Google Sheets API
                            (Whisper)     (Llama 3.1)     (googleapis)
                           Transcribe    Extract product   Stock + Sales
                             audio         name             CRUD
```

### Flujo detallado

1. Telegram envia un POST al webhook (API Gateway URL)
2. API Gateway forwardea a Lambda con el body como JSON string
3. `handler.ts` parsea el body y llama `bot.handleUpdate(update)`
4. grammY routea al handler correspondiente (`message:text` o `message:voice`)
5. **Texto**: se manda directo a Groq LLM para extraer el nombre del producto
6. **Audio**: se descarga el archivo de Telegram, se transcribe con Groq Whisper, y despues se extrae el producto del texto transcripto
7. Se busca el producto en la hoja "Stock" (match parcial, case-insensitive, solo los que estan "Disponible")
8. Si lo encuentra: marca como "Vendido" en Stock y appendea una fila en "Sales" con producto, fecha y precio
9. Le responde al usuario con el resultado

## Stack tecnologico

| Componente | Tecnologia |
|---|---|
| Runtime | Node.js 20 |
| Lenguaje | TypeScript (strict mode) |
| Bot framework | [grammY](https://grammy.dev/) v1.21 |
| AI - Transcripcion | Vercel AI SDK + Groq Whisper (`whisper-large-v3-turbo`) |
| AI - Extraccion | Vercel AI SDK + Groq LLM (`llama-3.1-8b-instant`) |
| Google Sheets | `googleapis` v144 (cliente oficial de Google) |
| Validacion | Zod v3 |
| Infra | AWS Lambda + API Gateway via Terraform |
| Bundler | esbuild (custom build script) |
| Package manager | pnpm |
| Dev tools | tsx (para scripts locales) |

## Estructura del proyecto

```
bot-telegram-google-sheets/
├── src/
│   ├── handler.ts              # Entry point de Lambda. Parsea el body de API Gateway y ejecuta bot.handleUpdate()
│   ├── config.ts               # Validacion de env vars con Zod. Falla rapido si falta algo.
│   ├── bot/
│   │   └── index.ts            # Crea el bot grammY con botInfo estatica. Handlers para text y voice.
│   ├── ai/
│   │   ├── extract.ts          # Extrae nombre de producto con Groq LLM (generateObject + Zod schema)
│   │   └── transcribe.ts       # Transcribe audio con Groq Whisper via Vercel AI SDK
│   └── sheets/
│       ├── client.ts           # Singleton del cliente googleapis autenticado con JWT
│       └── operations.ts       # CRUD: findProductInStock, markProductAsSold, appendSale, processSale
├── scripts/
│   ├── set-webhook.ts          # Configura el webhook de Telegram con la URL de API Gateway
│   ├── server.ts               # Servidor Express local para desarrollo (webhook local)
│   ├── test-local.ts           # Tests manuales: extraccion AI + conexion Sheets + flujo completo
│   └── debug-sheets.ts         # Debug: muestra el contenido de las hojas Stock y Sales
├── terraform/
│   ├── main.tf                 # Provider AWS y version de Terraform
│   ├── lambda.tf               # Lambda function, API Gateway, integracion y deployment
│   ├── iam.tf                  # IAM role para Lambda con permisos basicos
│   ├── variables.tf            # Variables: tokens, API keys, region, spreadsheet ID
│   ├── outputs.tf              # Outputs: URL del API Gateway y nombre de la Lambda
│   ├── terraform.tfvars.example    # Template de variables (copiar a terraform.tfvars)
│   ├── google-credentials.json.example  # Template de credenciales Google (copiar a google-credentials.json)
│   └── README.md               # Documentacion especifica de Terraform
├── build.mjs                   # Build script con esbuild + plugin native-fetch (CRITICO, ver Gotchas)
├── package.json                # Dependencias y scripts
├── tsconfig.json               # Config TypeScript (ES2022, NodeNext, strict)
├── .gitignore                  # Ignora node_modules, dist, .env, tfvars, credentials, tfstate
└── README.md                   # Este archivo
```

## Requisitos previos

- **Node.js 20+** (IMPORTANTE: tiene que ser 20+ por el native fetch)
- **pnpm** (package manager)
- **AWS CLI** configurado con tus credenciales (`aws configure`)
- **Terraform** >= 1.0
- **Cuenta de Groq** ([console.groq.com](https://console.groq.com/))
- **Proyecto en Google Cloud** con la Google Sheets API habilitada
- **Bot de Telegram** creado via [@BotFather](https://t.me/BotFather)
- **Google Spreadsheet** con la estructura correcta (ver paso 3)

## Setup paso a paso

### 1. Clonar el repo e instalar dependencias

```bash
git clone <url-del-repo>
cd bot-telegram-google-sheets
pnpm install
```

### 2. Configurar credenciales

Hay **5 credenciales** que necesitas. Aca te explico cada una, donde obtenerla y donde ponerla.

#### 2.1 Telegram Bot Token

- **Donde obtenerlo**: Habla con [@BotFather](https://t.me/BotFather) en Telegram. Manda `/newbot`, seguí las instrucciones, y te da un token tipo `8502029031:AAH...`
- **Donde ponerlo**: `terraform/terraform.tfvars` → `telegram_bot_token`
- **IMPORTANTE**: Tambien necesitas el `botInfo` hardcodeado en `src/bot/index.ts`. Despues de crear el bot, hace un GET a `https://api.telegram.org/bot<TU_TOKEN>/getMe` y copia los datos (`id`, `first_name`, `username`, etc.) en el objeto `botInfo` del constructor del Bot. Esto es CRITICO para evitar timeouts en Lambda (ver Gotchas).

#### 2.2 Groq API Key

- **Donde obtenerla**: Registrate en [console.groq.com](https://console.groq.com/), anda a API Keys y creá una
- **Donde ponerla**: `terraform/terraform.tfvars` → `groq_api_key`

#### 2.3 Google Service Account (credenciales JSON)

- **Donde obtenerlo**:
  1. Anda a [Google Cloud Console](https://console.cloud.google.com/)
  2. Crea un proyecto (o usa uno existente)
  3. Habilita la **Google Sheets API** (buscala en "APIs & Services > Library")
  4. Anda a **IAM & Admin > Service Accounts**
  5. Crea un Service Account (el nombre no importa)
  6. En la pestana **Keys**, genera una nueva key en formato **JSON**
  7. Descargá el archivo
- **Donde ponerlo**: Copia el contenido del JSON descargado a `terraform/google-credentials.json`

```bash
cd terraform
cp google-credentials.json.example google-credentials.json
# Pega el contenido real del JSON que descargaste
```

#### 2.4 Spreadsheet ID

- **Donde obtenerlo**: Abrí tu Google Sheet y mira la URL:
  ```
  https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit
                                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                         ESE es el Spreadsheet ID
  ```
- **Donde ponerlo**: `terraform/terraform.tfvars` → `spreadsheet_id`

#### 2.5 Webhook Secret

- **Donde obtenerlo**: Generalo vos, cualquier string random. Ejemplo:
  ```bash
  openssl rand -hex 32
  ```
- **Donde ponerlo**: `terraform/terraform.tfvars` → `webhook_secret`

#### Resumen: crear `terraform.tfvars`

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edita `terraform.tfvars` con tus valores:

```hcl
aws_region         = "us-east-1"
telegram_bot_token = "8502029031:AAH_tu_token_real"
webhook_secret     = "un_string_random_largo"
groq_api_key       = "gsk_tu_api_key_de_groq"
spreadsheet_id     = "1AbCdEfGhIjKlMnOpQrStUvWxYz"
```

### 3. Configurar Google Sheets

Crea un Google Spreadsheet con **dos hojas** (sheets/tabs):

#### Hoja "Stock"

| Producto | Estado | Precio |
|---|---|---|
| Zapatillas Nike | Disponible | 45000 |
| Buzo Adidas | Disponible | 32000 |
| Campera North Face | Vendido | 89000 |
| Remera Puma | Disponible | 15000 |

- **Columna A (Producto)**: nombre del producto
- **Columna B (Estado)**: `Disponible` o `Vendido`. El bot busca solo los que dicen `Disponible` (case-insensitive) y los cambia a `Vendido` cuando se procesa una venta.
- **Columna C (Precio)**: precio numerico (sin simbolo $)
- **Fila 1**: headers (el bot los skipea, arranca de la fila 2)

#### Hoja "Sales"

| Producto | Fecha | Precio |
|---|---|---|
| Zapatillas Nike | 2025-01-15 | 45000 |

- **Columna A (Producto)**: nombre del producto vendido (copiado de Stock)
- **Columna B (Fecha)**: fecha de la venta en formato `YYYY-MM-DD` (generada automaticamente)
- **Columna C (Precio)**: precio (copiado de Stock)
- El bot usa `append`, asi que las ventas se agregan al final de la hoja automaticamente.

#### COMPARTIR CON EL SERVICE ACCOUNT

Esto es **CRITICO** y se olvida siempre:

1. Abrí el archivo `terraform/google-credentials.json`
2. Busca el campo `client_email` (algo como `mi-bot@mi-proyecto.iam.gserviceaccount.com`)
3. Anda al Google Sheet → Compartir → Agrega ese email como **Editor**

Sin esto, el bot va a tirar un error 403 al intentar leer o escribir la hoja.

### 4. Build

```bash
pnpm build
```

Esto ejecuta `build.mjs` que usa esbuild para bundlear todo en un solo archivo `dist/handler.js` (formato CommonJS, target Node 20).

### 5. Deploy con Terraform

```bash
cd terraform
terraform init      # Solo la primera vez
terraform plan      # Ver que cambios se van a aplicar
terraform apply     # Aplicar (te pide confirmacion)
```

Terraform crea:
- Lambda function (`telegram-bot-sheets`) con 512MB RAM y 60s timeout
- API Gateway REST API con un endpoint `/webhook` (POST)
- IAM role con permisos basicos de ejecucion
- Las env vars de la Lambda con todos los secrets

Despues del `apply`, Terraform muestra los outputs:
- `api_endpoint`: la URL del API Gateway (algo como `https://xxx.execute-api.us-east-1.amazonaws.com/prod`)
- `lambda_function_name`: `telegram-bot-sheets`

### 6. Configurar el webhook de Telegram

Necesitas decirle a Telegram que mande los updates a tu API Gateway. La URL del webhook es:

```
{api_endpoint}/webhook
```

Por ejemplo: `https://xxx.execute-api.us-east-1.amazonaws.com/prod/webhook`

#### Opcion A: Script incluido

Crea un archivo `.env` en la raiz con:

```env
TELEGRAM_BOT_TOKEN=tu_token
WEBHOOK_SECRET=tu_secret
```

Y ejecuta:

```bash
npx tsx scripts/set-webhook.ts https://xxx.execute-api.us-east-1.amazonaws.com/prod/webhook
```

#### Opcion B: curl directo

```bash
curl -X POST "https://api.telegram.org/bot<TU_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://xxx.execute-api.us-east-1.amazonaws.com/prod/webhook", "secret_token": "<TU_WEBHOOK_SECRET>"}'
```

#### Verificar que funciona

```bash
curl "https://api.telegram.org/bot<TU_TOKEN>/getWebhookInfo"
```

Deberia mostrar la URL del webhook y `pending_update_count: 0`.

### 7. Deploy rapido (solo codigo, sin cambiar infra)

Si solo cambiaste codigo TypeScript y no la infraestructura de Terraform:

```bash
pnpm build && powershell -Command "Compress-Archive -Path dist/handler.js -DestinationPath dist/lambda.zip -Force" && aws lambda update-function-code --function-name telegram-bot-sheets --zip-file fileb://dist/lambda.zip
```

En Linux/Mac reemplaza el `powershell` por:

```bash
pnpm build && cd dist && zip lambda.zip handler.js && cd .. && aws lambda update-function-code --function-name telegram-bot-sheets --zip-file fileb://dist/lambda.zip
```

## Scripts de desarrollo

| Comando | Que hace |
|---|---|
| `pnpm build` | Bundlea el proyecto con esbuild a `dist/handler.js` |
| `pnpm dev:server` | Levanta un servidor Express local en el puerto 3000 para desarrollo |
| `pnpm test-local` | Corre tests manuales: extraccion AI + conexion Sheets + flujo completo de venta |
| `pnpm debug-sheets` | Muestra todo el contenido de las hojas Stock y Sales (para debugging) |

Para los scripts locales necesitas un `.env` en la raiz con las mismas variables que usa Lambda:

```env
TELEGRAM_BOT_TOKEN=tu_token
WEBHOOK_SECRET=tu_secret
GROQ_API_KEY=gsk_xxx
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
SPREADSHEET_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz
```

**NOTA**: `GOOGLE_SERVICE_ACCOUNT_JSON` en el `.env` va todo en una sola linea como JSON stringificado.

## Gotchas y problemas conocidos

Esta seccion es **la mas importante** para quien quiera replicar o mantener este proyecto. Cada uno de estos puntos represento horas de debugging.

### 1. grammY + esbuild + Lambda: el problema de node-fetch

**Problema**: grammY internamente usa `node-fetch` y `abort-controller`. Cuando esbuild bundlea todo, incluye esos paquetes. Pero en Node 20+ ya existen `fetch`, `AbortController`, etc. como globals nativos. El bundle termina con dos implementaciones de fetch que se pisan.

**Solucion**: El archivo `build.mjs` tiene un plugin de esbuild (`nativeFetchPlugin`) que intercepta los imports de `node-fetch` y `abort-controller` y los reemplaza con los globals nativos:

```javascript
build.onResolve({ filter: /^node-fetch$/ }, () => ({
  path: 'node-fetch',
  namespace: 'native-fetch',
}));
build.onLoad({ filter: /.*/, namespace: 'native-fetch' }, () => ({
  contents: `
    module.exports = fetch;
    module.exports.default = fetch;
    module.exports.Request = Request;
    module.exports.Response = Response;
    module.exports.Headers = Headers;
  `,
  loader: 'js',
}));
```

**NO marques `node-fetch` como `external`** en esbuild. Lambda no tiene ese paquete instalado, y vas a recibir un `Cannot find module 'node-fetch'` en runtime.

### 2. bot.init() causa timeout en Lambda

**Problema**: Si creas el bot con `new Bot(token)` sin pasar `botInfo`, grammY llama `bot.init()` automaticamente la primera vez que procesa un update. Eso hace un GET a `https://api.telegram.org/bot.../getMe`. En un cold start de Lambda, esto puede causar un timeout de 60 segundos.

**Solucion**: Pasar `botInfo` estatica en el constructor:

```typescript
const bot = new Bot(config.TELEGRAM_BOT_TOKEN, {
  botInfo: {
    id: 8502029031,
    is_bot: true,
    first_name: 'BotSheetsGoogle',
    username: 'GoogleSheetsNachoTest150397_bot',
    can_join_groups: true,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
  },
});
```

Para obtener estos valores, hace un GET a `https://api.telegram.org/bot<TU_TOKEN>/getMe` y copia la respuesta.

### 3. API Gateway vs Function URL: formato del evento

**Problema**: grammY tiene `webhookCallback(bot, 'aws-lambda-async')` que espera el formato de **Function URL** de Lambda (donde el body ya viene parseado). Con **API Gateway** (proxy integration), el body viene como JSON string.

**Solucion**: NO usar `webhookCallback`. En `handler.ts` parseamos manualmente:

```typescript
const update = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
await bot.handleUpdate(update);
```

### 4. Corrupcion de credenciales Google (private key)

**Problema**: Si la private key en `google-credentials.json` se trunca (ej: no termina con `-----END PRIVATE KEY-----`), vas a recibir un error `ERR_OSSL_UNSUPPORTED` críptico al intentar autenticar con Google.

**Solucion**: Verificar que el JSON tenga la key completa. Tiene que empezar con `-----BEGIN PRIVATE KEY-----` y terminar con `-----END PRIVATE KEY-----\n`. Los `\n` dentro de la key son saltos de linea (es normal que aparezcan asi en JSON).

### 5. Lambda container reuse (codigo viejo)

**Problema**: Despues de deployar codigo nuevo, Lambda puede seguir usando containers viejos con el codigo anterior. Esto pasa porque Lambda reutiliza containers "warm".

**Solucion**: Mira los logs en CloudWatch. Busca un log `INIT_START` que confirme que se inicio un container nuevo con tu codigo actualizado. Si no lo ves, espera unos minutos o invoca la funcion varias veces para forzar el recycle.

### 6. googleapis vs google-spreadsheet

**Problema**: Inicialmente se uso el paquete npm `google-spreadsheet` (wrapper simplificado). Tenia problemas de autenticacion en Lambda por cosas internas del manejo de JWT.

**Solucion**: Se migro al cliente oficial `googleapis`. Es mas verboso pero funciona perfecto en Lambda. El paquete `google-spreadsheet` sigue en `package.json` como dependencia residual, pero no se usa.

### 7. Variables de entorno en Terraform

Las credenciales de Google se cargan desde el archivo `terraform/google-credentials.json` usando `file()` de Terraform y se pasan como una env var `GOOGLE_SERVICE_ACCOUNT_JSON` a Lambda. Esto significa que **todo el JSON del service account** se mete en una variable de entorno. Funciona, pero tiene un limite de 4KB total para todas las env vars de Lambda (en la practica, sobra).

### 8. El bot crea la instancia fuera del handler

En `handler.ts`, la linea `const bot = createBot()` esta **fuera** del handler. Esto es intencional: Lambda reutiliza el contexto entre invocaciones ("warm container"), asi que el bot se crea una sola vez y se reutiliza. Lo mismo aplica para el cliente de Google Sheets (`sheetsClient` singleton en `client.ts`).

## Variables de entorno

| Variable | Descripcion | Donde se configura |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram | `terraform.tfvars` |
| `WEBHOOK_SECRET` | Secret para verificar webhook de Telegram | `terraform.tfvars` |
| `GROQ_API_KEY` | API key de Groq para AI | `terraform.tfvars` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JSON completo del Service Account de Google | `terraform/google-credentials.json` (se carga via `file()`) |
| `SPREADSHEET_ID` | ID del Google Spreadsheet | `terraform.tfvars` |
| `AWS_REGION` | Region de AWS (default: `us-east-1`) | `terraform.tfvars` |

## Costos

| Servicio | Costo |
|---|---|
| AWS Lambda | $0 (free tier: 1M invocaciones/mes + 400.000 GB-s) |
| API Gateway | $0 (free tier: 1M llamadas/mes por 12 meses) |
| Groq AI | $0 (free tier generoso) |
| Google Sheets API | $0 |
| Telegram Bot API | $0 |

Para un bot personal o de bajo trafico, esto corre 100% gratis.

## Pendientes

- [ ] Testear mensajes de audio/voz end-to-end en Lambda (funciona en local, falta validar en prod)
- [ ] Limpiar la dependencia `google-spreadsheet` del `package.json` (no se usa, quedo residual)
- [ ] Agregar manejo de errores mas granular (ej: diferenciar "producto no encontrado" de "error de Sheets")
- [ ] Agregar un comando `/stock` para listar productos disponibles
- [ ] Agregar un comando `/ventas` para ver las ultimas ventas

## Como funciona cada modulo (referencia tecnica)

### `src/config.ts`

Usa Zod para validar que todas las env vars requeridas existan al iniciar. Si falta alguna, la Lambda falla inmediatamente con un error claro en vez de fallar misteriosamente despues.

### `src/handler.ts`

Entry point de Lambda. Crea el bot una sola vez (fuera del handler), y en cada invocacion:
1. Verifica el `X-Telegram-Bot-Api-Secret-Token` header
2. Parsea el body (API Gateway lo manda como string)
3. Ejecuta `bot.handleUpdate(update)`
4. Retorna 200 OK o 500

### `src/bot/index.ts`

Factory function que crea y configura el bot grammY. Registra dos handlers:
- `message:text` → extrae producto con AI → procesa venta
- `message:voice` → descarga audio → transcribe con Whisper → extrae producto → procesa venta

### `src/ai/extract.ts`

Usa Vercel AI SDK con Groq (`llama-3.1-8b-instant`) para extraer el nombre del producto de un mensaje en lenguaje natural. Retorna un objeto tipado con `productName` y `confidence` (high/medium/low). Si la confianza es "low", el bot pide al usuario que reformule.

### `src/ai/transcribe.ts`

Usa Vercel AI SDK con Groq Whisper (`whisper-large-v3-turbo`) para transcribir audio a texto. Configurado para espanol.

### `src/sheets/client.ts`

Crea un cliente singleton de `googleapis` autenticado con JWT usando las credenciales del Service Account. Se reutiliza entre invocaciones de Lambda (container reuse).

### `src/sheets/operations.ts`

Operaciones CRUD sobre Google Sheets:
- `findProductInStock(name)`: busca un producto por nombre (match parcial, case-insensitive) que este "Disponible"
- `markProductAsSold(rowIndex)`: cambia el estado a "Vendido"
- `appendSale(record)`: agrega una fila a la hoja Sales
- `processSale(name)`: orquesta todo el flujo de venta (buscar → marcar → registrar)

### `build.mjs`

Script de esbuild con un plugin custom (`nativeFetchPlugin`) que reemplaza `node-fetch` y `abort-controller` con los globals nativos de Node 20. Bundlea todo en un solo archivo CJS (`dist/handler.js`) con source maps.
