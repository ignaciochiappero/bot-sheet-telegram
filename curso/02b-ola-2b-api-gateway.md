# OLA 2B: API Gateway - El Portero

## La pregunta de esta ola

Lambda no tiene una URL pública directamente accesible. ¿Cómo llegamos desde internet hasta nuestro código? Con API Gateway.

---

## El problema

Lambda es como una función en una calculadora:

```
┌─────────────────────────────────────┐
│           AWS LAMBDA                 │
│                                     │
│   function handler(event) {        │
│     // nuestro código               │
│   }                                │
│                                     │
│   ❌ No tiene IP pública            │
│   ❌ No tiene URL accesible         │
│   ✅ Solo existe dentro de AWS      │
└─────────────────────────────────────┘
```

Si intentás acceder a Lambda directamente desde internet, no funciona.

---

## ¿Qué es API Gateway?

API Gateway es un **proxy** que expone Lambda al mundo:

```
Internet ──▶ API Gateway ──▶ Lambda ──▶ Nuestro código
```

```
https://2cbv2q41lj.execute-api.us-east-1.amazonaws.com/prod/webhook
                         │
                         └────────────────────────┘
                              │
                    La URL pública de API Gateway
```

---

## Las partes de API Gateway

```
┌─────────────────────────────────────────────────────────────┐
│                    API GATEWAY                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  REST API (recurso)                                 │  │
│  │  └── /webhook (recurso hijo)                       │  │
│  │        └── POST (método HTTP)                       │  │
│  │              └── Lambda Integration                 │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  • Traduce HTTP a eventos de Lambda                       │
│  • Maneja auth, rate limiting, CORS                       │
│  • Cachea respuestas si querés                            │
│  • Mide uso (cuántas requests)                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Tipos de integración

| Tipo | Para qué sirve |
|------|---------------|
| **Lambda Proxy Integration** | Pasa todo el request a Lambda (body, headers, etc.) |
| **Lambda Non-Proxy (LAMBDA)** | Vos manually extraes lo que necesitás |
| **HTTP** | Proxy a un servidor externo |
| **Mock** | Devuelve respuestas fijas |

Nosotros usamos **Lambda Proxy Integration** (`AWS_PROXY` en Terraform):

```hcl
resource "aws_api_gateway_integration" "lambda" {
  type = "AWS_PROXY"  # Lambda Proxy Integration
  uri  = aws_lambda_function.telegram_bot.invoke_arn
}
```

Con esto, Lambda recibe el evento completo y decide qué responder.

---

## El formato del evento

Cuando Telegram hace POST a nuestro webhook, API Gateway lo transforma:

```
POST /prod/webhook
Content-Type: application/json
{"update_id": 123, "message": {...}}
```

Lambda recibe algo así:

```json
{
  "resource": "/webhook",
  "httpMethod": "POST",
  "headers": { "Content-Type": "application/json" },
  "body": "{\"update_id\": 123, \"message\": {...}}",
  "queryStringParameters": null,
  "pathParameters": null
}
```

Por eso en nuestro código hacemos:

```typescript
const update = typeof event.body === 'string' 
  ? JSON.parse(event.body) 
  : event.body;
```

---

## API Gateway vs Function URL

AWS ofrece dos formas de exponer Lambda:

| Método | URL | Costo | Pros | Contras |
|--------|-----|-------|------|---------|
| **API Gateway** | `*.amazonaws.com/prod/*` | ~$3.50/1M | Control total, auth, CORS | Más caro, más complejo |
| **Function URL** | `*.lambda-url.*` | Gratis | Simple, barato | Menos control, tuvo 403s |

Nosotros usamos **API Gateway** porque:
1. El webhook de Telegram necesita POST
2. Queríamos control sobre el endpoint
3. El Function URL tuvo problemas de 403

---

## Rate Limiting

API Gateway permite controlar cuántas requests acepta:

```hcl
# En usage plan
resource "aws_api_gateway_usage_plan" "main" {
  name = "telegram-bot-usage"
  
  quota_settings {
    limit  = 1000
    period = "MONTH"
  }
  
  throttle_settings {
    burst_limit = 10
    rate_limit = 5
  }
}
```

Por defecto, el free tier de Lambda + API Gateway ya cubre un bot personal.

---

## La idea clave de esta ola

> **API Gateway es el portero que recibe el pedido de Telegram y se lo pasa a Lambda. Traduce HTTP al formato que Lambda entiende y devuelve la respuesta. Sin API Gateway, Lambda sería inaccesible desde internet.**

---

## ¿Por qué no Function URL?

Function URL es más simple y barato (o gratis), pero tuvo problemas con Telegram:

- No suportaba POST correctamente en algunos casos
- Daba 403 intermittently
- No tiene control fino sobre CORS

API Gateway es más robusto para este caso de uso.

---

## Resumen

- Lambda no tiene URL pública
- API Gateway expone Lambda al mundo
- Traduce HTTP → Lambda event
- Cobra por request (pero tiene free tier)
- Es más controlable que Function URL

---

## Próxima ola

**OLA 3: AWS Lambda** — ¿Qué es Lambda y por qué no mantenemos un servidor?
