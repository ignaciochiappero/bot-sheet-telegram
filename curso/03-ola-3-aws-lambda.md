# OLA 3: AWS Lambda

## La pregunta de esta ola

¿Qué es Lambda y por qué no tenemos que pagar un servidor que esté prendido 24/7?

---

## La forma "tradicional" de hacer un bot

Antes de Lambda, si querías un bot, necesitabas:

```
┌─────────────────────────────────────────┐
│           TU SERVIDOR (VPS)             │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │  • Ubuntu/Linux instalado       │   │
│   │  • Node.js runtime              │   │
│   │  • Tu código del bot            │   │
│   │  • Nginx como reverse proxy     │   │
│   │  • Certificados SSL             │   │
│   │  • PM2 para mantener vivo       │   │
│   └─────────────────────────────────┘   │
│                                         │
│   Costos: $5-10 USD/mese               │
│   Mantenimiento: actualizar paquetes,   │
│   monitorear, reiniciar si se cae...   │
└─────────────────────────────────────────┘
```

Problemas:
- Pagas aunque nadie use el bot
- Si se cuelga, tenés que reiniciar a mano
- Actualizar dependencias es un dolor de cabeza

---

## La forma Lambda (serverless)

Con Lambda, no hay servidor. Vos escribís código, subís, y AWS lo ejecuta:

```
┌─────────────────────────────────────────┐
│              AWS LAMBDA                 │
│                                         │
│   Tu código se ejecuta cuando           │
│   alguien lo invoca. Ni antes,         │
│   ni después.                           │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │  function handler(event) {      │   │
│   │    // tu código                 │   │
│   │  }                              │   │
│   └─────────────────────────────────┘   │
│                                         │
│   Costo: $0 si usás < 1M req/mese      │
│   Mantenimiento: 0 (AWS lo maneja)     │
└─────────────────────────────────────────┘
```

---

## ¿Cómo se ejecuta?

Lambda es como un **timer de cocina**. Vos ponés la comida (evento),設定 el tiempo, y cuando suena, se ejecuta.

```typescript
// Esto es el "timer"
export async function handler(event, context) {
  // Este código corre cuando alguien invoca la función
  const update = JSON.parse(event.body);
  await bot.handleUpdate(update);
  
  return { statusCode: 200 };
}
```

El evento puede ser:
- Un pedido HTTP (via API Gateway)
- Un archivo subido a S3
- Un mensaje de una cola (SQS)
- Un timer (CloudWatch)
- etc.

---

## Cuándo se "prende" Lambda?

```
┌────────────────────────────────────────────────────────────┐
│                    COLD START                              │
│                                                            │
│  Primera vez que se invoca Lambda:                        │
│  1. AWS provisiona un container                          │
│  2. Descarga tu código                                    │
│  3. Inicia el runtime (Node.js)                          │
│  4. Ejecuta tu código                                    │
│                                                            │
│  Tiempo: ~1-3 segundos                                    │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│                    WARM START                              │
│                                                            │
│  Si se invoca de nuevo dentro de ~5-10 min:              │
│  1. El container ya existe                               │
│  2. Solo ejecuta tu código                                │
│  3. Listo                                                 │
│                                                            │
│  Tiempo: ~100-500ms                                      │
└────────────────────────────────────────────────────────────┘
```

Por eso el primer mensaje al bot puede tardar un poco más.

---

## ¿Cuánto cuesta?

| Servicio | Free Tier | Costo después |
|----------|-----------|---------------|
| Lambda | 1M invocaciones/mes | $0.20 por 1M |
| API Gateway | 1M requests/mes | $3.50 por 1M |
| CloudWatch (logs) | 1GB/mes | $0.50/GB |

Para un bot personal: **$0** todos los meses.

---

## El archivo de configuración

En `terraform/lambda.tf` definimos la función:

```hcl
resource "aws_lambda_function" "telegram_bot" {
  function_name = "telegram-bot-sheets"
  runtime       = "nodejs20.x"
  handler       = "handler.handler"
  memory_size   = 512  # MB
  timeout       = 60    # segundos
  
  # Acá van las variables de entorno
  environment {
    variables = {
      TELEGRAM_BOT_TOKEN = var.telegram_bot_token
      GROQ_API_KEY      = var.groq_api_key
      # ...
    }
  }
}
```

---

## El desafío que tuvimos

Cuando deployamos la primera vez, el código funcionaba local pero **no funcionaba en Lambda**. ¿Por qué?

### Problema 1: node-fetch vs native fetch

grammY usa internamente `node-fetch`. Pero Node.js 20 ya tiene `fetch` nativo. Cuando esbuild bundleaba todo, había dos versiones del fetch y se冲突ban.

**Solución**: Un plugin de esbuild que reemplaza `node-fetch` con los native globals.

### Problema 2: Container reuse

Después de deployar código nuevo, Lambda puede reuse containers viejos. Hay que verificar que levantó el código nuevo buscando `INIT_START` en CloudWatch.

---

## La idea clave de esta ola

> **Lambda es como un hotel: pagás por noche (invocación), no por tener la habitación reservada todo el mes. Cuando alguien escribe, se "alquila" un container, ejecuta tu código, y se libera. Por eso sale gratis para uso bajo.**

---

## Próxima ola

**OLA 4: grammY** — ¿Cómo procesa el bot los mensajes?
