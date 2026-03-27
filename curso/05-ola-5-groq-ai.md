# OLA 5: Groq AI - La Inteligencia

## La pregunta de esta ola

¿Cómo hace el bot para entender "María compró una remera por 45000 en efectivo" y transformar eso en datos estructurados?

---

## El problema

Nosotros queremos que el usuario escriba **en lenguaje natural**:

> "María encargó un jean azul Talle 42 por 35000 transferencia"

Y el sistema extraiga:

| Campo | Valor |
|-------|-------|
| Clienta/e | María |
| Prendas | jean azul |
| Medida | 42 |
| Color | azul |
| Monto $ | 35000 |
| Tipo Pago | transferencia |

¿Cómo pasamos de texto libre a una planilla estructurada? **Inteligencia Artificial (IA)**.

---

## ¿Qué es un LLM?

**Large Language Model** (Modelo de Lenguaje Grande). Son modelos de IA entrenados con millones de textos para predecir la siguiente palabra.

Imaginate un autocomplete extremadamente avanzado:

```
Usuario: "María compr"
Modelo:  "ó una remera por 45000 en efectivo"
```

No es "inteligencia" en el sentido humano. Es **estadística extrema**: dado el texto de entrada, predice qué texto sigue.

---

## Groq como proveedor

Groq es una empresa que ofrece acceso a LLMs (como Llama de Meta, Gemma de Google, etc.) via API.

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Nuestro    │───▶│    Groq      │───▶│    LLM       │
│   código     │    │   (API)      │    │  (Llama 3.3) │
└──────────────┘    └──────────────┘    └──────────────┘
```

Llamamos a la API de Groq con:
- El mensaje del usuario
- Instrucciones de qué hacer
- Un schema (estructura) de lo que queremos

Groq devuelve los datos extraídos.

---

## El código de extracción

En `src/ai/extract.ts`:

```typescript
import { generateObject } from 'ai';
import { groq } from '@ai-sdk/groq';

const schema = z.object({
  'Clienta/e': z.string(),
  'Prendas': z.string(),
  'Medida': z.string().nullable(),
  'Color': z.string().nullable(),
  'Monto $': z.number(),
  'Tipo Pago': z.string(),
});

const result = await generateObject({
  model: groq('llama-3.3-70b-versatile'),
  schema: schema,
  system: 'Extrae los datos de la venta...',
  prompt: mensajeDelUsuario,
});

const datos = result.object;
```

`generateObject` le dice al LLM: "Devolvé un objeto con esta estructura".

---

## System Prompt

El **system prompt** es como las instrucciones que le das al modelo:

```
Extraé los siguientes datos del mensaje del usuario.
Si un dato no está presente, devolvé null para ese campo.

Campos:
- Clienta/e (string, obligatorio): Nombre de la persona
- Prendas (string, obligatorio): Productos vendidos
- Medida (string, opcional): Talle
- Color (string, opcional): Color
- Monto $ (number, obligatorio): Monto en pesos
- Tipo Pago (string, obligatorio): Forma de pago
```

El modelo "lee" estas instrucciones y trata de extraer lo que le pedís.

---

## Fallback entre modelos

Groq puede estar saturado (rate limit). Si un modelo falla, probamos con otro:

```typescript
const modelos = [
  'llama-3.3-70b-versatile',  // El mejor, pero puede fallar
  'llama-3.1-8b-instant',      // Rápido y confiable
  'gemma2-9b-it',              // Fallback final
];

for (const modelo of modelos) {
  try {
    const resultado = await generateObject({
      model: groq(modelo),
      // ...
    });
    return resultado;
  } catch (error) {
    if (error.code === 'rate_limit') {
      continue; // Probar el siguiente
    }
    throw error; // Error real, parar
  }
}
```

---

## Transcripción de audio

Para mensajes de voz, el flujo es:

```
Audio (.ogg) ──▶ Groq Whisper ──▶ Texto ──▶ Extracción
                (transcribe)       ↑              │
                                   │              │
                                   └──────────────┘
```

Groq tiene un modelo específico para audio: **Whisper**.

```typescript
// Llamada directa a la API (bypaseamos AI SDK por un bug)
const formData = new FormData();
formData.append('file', audioBlob);
formData.append('model', 'whisper-large-v3-turbo');

const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${API_KEY}` },
  body: formData,
});
```

---

## ¿Cuánto cuesta?

Groq tiene free tier generoso:

| Uso | Costo |
|-----|-------|
| Llama 3.3 (8K context) | ~$0 (gran free tier) |
| Whisper (audio) | ~$0 (gran free tier) |

Para este bot: **$0**.

---

## La idea clave de esta ola

> **El LLM no "entiende" como un humano. Usa estadística para predecir qué texto sigue. Le damos un schema (estructura de lo que queremos) y un system prompt (instrucciones), y él transforma el mensaje libre en datos estructurados.**

---

## Próxima ola

**OLA 6: Google Sheets** — ¿Cómo guardamos los datos?
