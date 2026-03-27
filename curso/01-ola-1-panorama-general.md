# OLA 1: El Panorama General

## La pregunta del millón

¿Cómo funciona esta app? Antes de meternos en código, entendamos el **qué** y el **para qué**.

---

## ¿Qué hace este bot?

Cuando tu novia le manda un mensaje al bot diciendo:

> "María compro una remera negra por 45000 en efectivo"

El bot automáticamente:
1. **Lee el mensaje**
2. **Entiende** qué datos están ahí (cliente, prendas, precio, forma de pago)
3. **Los transforma** en una fila de Google Sheets
4. **Le responde** confirmando que se registró

Todo esto pasa **sin que nadie toque una planilla de cálculo**.

---

## Las 4 partes del sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        TELEGRAM                                 │
│                   (donde tu hija te escribe)                    │
└────────────────────────────┬────────────────────────────────────┘
                           │
                           │ mensaje de texto
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AWS LAMBDA                                   │
│              (la "computadora" que ejecuta el código)          │
│                                                                  │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    │
│   │   grammY     │───▶│    Groq      │───▶│   Google     │    │
│   │  (el bot)   │    │    (IA)      │    │   Sheets     │    │
│   └──────────────┘    └──────────────┘    └──────────────┘    │
│         │                                        │              │
│         │   Procesa el mensaje                  │              │
│         │   decide que hacer                     │              │
│         └────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

Piezas del rompecabezas:

| Pieza | Qué hace | Ejemplo |
|-------|----------|---------|
| **Telegram** | Interfaz de chat donde el usuario escribe | WhatsApp pero es Telegram |
| **grammY** | Framework para crear bots de Telegram | "El que escucha y responde" |
| **Groq** | Inteligencia artificial que entiende texto | "El que lee entre líneas" |
| **Google Sheets** | Base de datos donde se guardan las ventas | "El cuaderno de ventas" |

---

## El flujo completo (sin detalles técnicos)

1. **Usuario escribe** en Telegram
2. **Telegram avisa** a Lambda via webhook (como un webhook de Slack)
3. **grammY recibe** el mensaje
4. **Groq analiza** el mensaje y extrae los datos (cliente, prendas, monto, etc.)
5. **grammY arma** una fila con esos datos
6. **Google Sheets** guarda la fila
7. **grammY responde** al usuario con confirmación

Todo esto pasa en **menos de 3 segundos**.

---

## ¿Por qué está armado así?

### ¿Por qué AWS Lambda?

Tradicionalmente, un servidor web está corriendo todo el tiempo, gastando plata aunque nobody lo use. Lambda solo **se enciende cuando alguien escribe**, cobra por milisegundo usado.

**Gratis** para uso bajo: 1 millón de invocaciones/mes sin pagar un centavo.

### ¿Por qué Google Sheets?

No necesitamos una base de datos compleja. Una planilla es:
- Fácil de editar a mano
- Fácil de compartir
- Tiene API gratis
- Tu novia ya sabe usarla

### ¿Por qué Groq?

Groq es un proveedor de LLMs (Inteligencia Artificial) rápido y económico. Usamos `Llama` (de Meta) para entender el texto.

**Gratis** para uso bajo también.

---

## La idea clave de esta ola

> **El sistema tiene 4 piezas que se pasan la pelota: Telegram → Bot (grammY) → IA (Groq) → Datos (Sheets)**

En las próximas olas vamos a ver cada pieza en detalle, cómo se comunican entre sí, y por qué elegimos cada tecnología.

---

## Próxima ola

**OLA 2: Telegram + Webhooks** — ¿Cómo llega el mensaje desde Telegram hasta nuestro código?
