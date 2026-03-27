# OLA 4: grammY - El Bot

## La pregunta de esta ola

Una vez que el mensaje llega a Lambda, ¿quién lo procesa? ¿Cómo sabe el bot qué hacer con un mensaje de texto vs un audio?

---

## ¿Qué es grammY?

grammY es un **framework** (librería) para crear bots de Telegram. Es lo que conecta nuestro código con la API de Telegram.

```
┌─────────────────────────────────────────────┐
│              TU CÓDIGO                      │
│                                             │
│   import { Bot } from 'grammy';            │
│   const bot = new Bot(token);              │
│                                             │
│   bot.on('message:text', ctx => {          │
│     // procesar mensaje de texto           │
│   });                                      │
│                                             │
│   bot.on('message:voice', ctx => {         │
│     // procesar mensaje de voz             │
│   });                                      │
└─────────────────┬───────────────────────────┘
                  │
                  │ bajo nivel
                  ▼
┌─────────────────────────────────────────────┐
│           TELEGRAM BOT API                  │
│              (los endpoints de Telegram)    │
└─────────────────────────────────────────────┘
```

grammY hace el trabajo sucio:
- Armar las requests a Telegram
- Manejar errores
- Proveer una API limpia para nosotros

---

## El flujo dentro del bot

```typescript
// 1. Crear el bot
const bot = new Bot(token, { botInfo });

// 2. Escuchar mensajes de texto
bot.on('message:text', async (ctx) => {
  const texto = ctx.message.text;
  
  // Acá va la lógica: extraer datos con IA
  // y guardar en Sheets
});

// 3. Escuchar mensajes de voz
bot.on('message:voice', async (ctx) => {
  // Descargar audio
  // Transcribir
  // Procesar como texto
});

// 4. Arrancar
await bot.handleUpdate(update);
```

---

## Cómo definimos el bot

En `src/bot/index.ts`:

```typescript
export function createBot(): Bot {
  const bot = new Bot(envConfig.TELEGRAM_BOT_TOKEN, {
    botInfo: { /* datos del bot */ }
  });

  // /start command
  bot.command('start', async (ctx) => {
    await ctx.reply('¡Hola!');
  });

  // Mensajes de texto
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text;
    // ... lógica
  });

  // Mensajes de voz
  bot.on('message:voice', async (ctx) => {
    // ... lógica
  });

  return bot;
}
```

---

## Los "middlewares"

grammY tiene un sistema de **middlewares** que permite encadenar acciones.

```
Mensaje ──▶ Middleware 1 ──▶ Middleware 2 ──▶ Handler
                    │                  │
                    ▼                  ▼
              (logging)          (autenticación)
```

Pero para este bot, no usamos middlewares complejos. Usamos el patrón simple:
- `bot.on('message:text')` para mensajes de texto
- `bot.on('message:voice')` para audios

---

## ¿Por qué no usar webhookCallback?

grammY provee `webhookCallback(bot, 'aws-lambda-async')` para integrar con Lambda.

**El problema**: Ese callback espera el formato de **Lambda Function URL**, no de **API Gateway**.

```typescript
// Esto NO funciona con API Gateway:
webhookCallback(bot, 'aws-lambda-async')(event);
```

**Nuestra solución**: procesar manualmente:

```typescript
// src/handler.ts
const update = typeof event.body === 'string' 
  ? JSON.parse(event.body) 
  : event.body;

await bot.handleUpdate(update);
```

---

## El desafío: bot.init()

La primera vez que se crea un bot, grammY hace un request a `/getMe` para obtener los datos del bot (nombre, username, etc.).

En un cold start de Lambda, ese request puede timeoutear (tardar más de 60 segundos).

**Solución**: Pasar `botInfo` estático en el constructor:

```typescript
const bot = new Bot(token, {
  botInfo: {
    id: 8502029031,
    is_bot: true,
    first_name: 'BotSheetsGoogle',
    username: 'GoogleSheetsNachoTest150397_bot',
    // ...
  }
});
```

Estos datos se obtienen una sola vez con:
```
https://api.telegram.org/bot<TOKEN>/getMe
```

---

## La idea clave de esta ola

> **grammY es el "traductor" entre Telegram y nuestro código. Escucha eventos (mensajes, comandos, callbacks) y los convierte en funciones que podemos escribir fácil. Lo que hace el bot está definido en esos `bot.on('message:xxx')`.**

---

## Próxima ola

**OLA 5: Groq AI** — ¿Cómo entiende el bot lo que escribimos?
