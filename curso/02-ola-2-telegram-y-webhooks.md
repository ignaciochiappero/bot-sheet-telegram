# OLA 2: Telegram + Webhooks

## La pregunta de esta ola

¿Cómo llega el mensaje que tu novia escribe en Telegram hasta el código que lo procesa?

---

## Un segundo... ¿qué es un webhook?

Imaginate que esperás un paquete. Podrías:

1. **Opción A: Llamar cada 5 minutos a la empresa de envíos** para preguntar "¿ya llegó?"
   - Esto se llama **polling** (sondear)
   - Gasta batería, datos, y es lento

2. **Opción B: Dejarle tu dirección a la empresa** y que te llamen cuando llegue
   - Esto es un **webhook**
   - No gastás nada hasta que pasa algo
   - Es instantáneo

Los **webhooks** son como dejar tu número para que te avisen. Cuando pasa algo (llegó el paquete, alguien escribió, etc.), el servidor te avisa.

---

## ¿Cómo funciona con Telegram?

```
┌──────────────┐                              ┌──────────────┐
│   Telegram   │                              │  AWS Lambda  │
│   (servidor) │──── POST /webhook ─────────▶│  (nuestro    │
│              │  { message: "..." }          │   código)    │
└──────────────┘                              └──────────────┘
```

1. Tu novia escribe en Telegram
2. Telegram detecta el mensaje
3. Telegram hace un **POST HTTP** a nuestra URL de webhook
4. Nuestro código recibe ese POST, procesa, responde
5. Listo

La URL del webhook es algo así:
```
https://2cbv2q41lj.execute-api.us-east-1.amazonaws.com/prod/webhook
```

---

## ¿Quién recibe ese POST?

Ahí entra **AWS API Gateway**:

```
Telegram ──POST──▶ API Gateway ──event──▶ Lambda ──▶ Código
```

**API Gateway** es como un portero:
- Le da una URL pública a Lambda (que no tiene IP pública)
- Traduce el formato de Telegram al formato que Lambda entiende
- Maneja seguridad, rate limiting, etc.

---

## El código que recibe el mensaje

En `src/handler.ts` pasa esto:

```typescript
// Esto es lo que llega desde API Gateway
const event = {
  body: '{"update_id":123, "message":{"text":"Hola"}}'
};

// Nosotros lo parseamos
const update = JSON.parse(event.body);

// Y se lo pasamos al bot
await bot.handleUpdate(update);
```

`handleUpdate` es como darle el mensaje al bot para que lo procese.

---

## El desafío: API Gateway vs Function URL

Hay dos formas de exponer Lambda al mundo:

| Método | Qué es | Pros | Contras |
|--------|--------|------|---------|
| **API Gateway** | REST API completa | Control total, autentificación | Más caro, más complejo |
| **Function URL** | URL directa de Lambda | Más simple, barato | Menos control, tuvo 403s |

Nosotros usamos **API Gateway** porque el webhook de Telegram requiere POST.

---

## La otra pieza: el Bot Token

Para que Telegram acepte nuestros pedidos, necesitamos un **token**:

```
8502029031:AAHxu3ltHvH-xPMG24DmI14becEiE0pIwhg
```

Se obtiene de @BotFather en Telegram. Es como la contraseña del bot.

Ese token se pasa en cada request a la API de Telegram:
```
https://api.telegram.org/bot<TOKEN>/sendMessage
```

---

## La idea clave de esta ola

> **Telegram no "consulta" si hay mensajes. Simplemente nos avisa (webhook) cuando alguien escribe. Nuestra URL está expuesta via API Gateway que le pasa el evento a Lambda.**

---

## Próxima ola

**OLA 2B: API Gateway** — ¿Cómo llegamos desde internet hasta Lambda?
