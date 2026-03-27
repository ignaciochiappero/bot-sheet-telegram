# OLA 6: Google Sheets - La Base de Datos

## La pregunta de esta ola

Una vez que el bot entiende los datos, ¿cómo los guardamos en una planilla de Google?

---

## ¿Por qué Google Sheets?

Podríamos haber usado una base de datos como PostgreSQL o MongoDB. Pero para este caso:

| Opción | Pros | Contras |
|--------|------|---------|
| **Google Sheets** | Gratis, fácil de usar, visible | Lento para millones de filas |
| **PostgreSQL** | Potente, estándar | Cuesta $, necesita hosting |
| **MongoDB** | Flexible | Cuesta $, overkill |

Google Sheets es perfecto para:
- Pocas ventas por día (< 1000)
- Tu novia puede editar a mano si necesita
- No paga nada
- Ya knows cómo usarlo

---

## La API de Google Sheets

Google provee una API REST para manipular planillas. Usamos el cliente oficial: `googleapis`.

```typescript
import { google } from 'googleapis';

const auth = new google.auth.JWT(
  client_email,
  null,
  private_key,
  ['https://www.googleapis.com/auth/spreadsheets']
);

const sheets = google.sheets({ version: 'v4', auth });
```

---

## Las operaciones básicas

### 1. Leer datos

```typescript
const response = await sheets.spreadsheets.values.get({
  spreadsheetId: '1vp3oF__...',
  range: 'Ventas!A:F',  // Hoja "Ventas", columnas A a F
});

const valores = response.data.values;
// [["Fecha","Cliente","Prendas",...], ["2025-01-15","María","Remera",...]]
```

### 2. Escribir una fila

```typescript
await sheets.spreadsheets.values.append({
  spreadsheetId: '1vp3oF__...',
  range: 'Ventas!A:F',
  valueInputOption: 'USER_ENTERED',
  requestBody: {
    values: [['2025-01-15', 'María', 'Remera', '45000', 'efectivo']]
  }
});
```

---

## La estructura de la planilla

```
┌─────────────────────────────────────────────────────────────┐
│ A           B           C           D          E      F      │
├─────────────────────────────────────────────────────────────┤
│ Fecha       Clienta/e  Prendas    Monto $    Tipo Pago      │
├─────────────────────────────────────────────────────────────┤
│ 2025-01-15  María       Remera     45000      Efectivo      │
│ 2025-01-16  Jose       Pantalón   35000      Transferencia │
│ ...                                                      ...
└─────────────────────────────────────────────────────────────┘
```

Cada columna es un campo. La primera fila son los **headers**.

---

## Autenticación: Service Account

Para que nuestro código pueda acceder a la planilla, necesitamos credenciales.

Google usa **Service Accounts**:

1. Creamos un proyecto en Google Cloud
2. Habilitamos "Google Sheets API"
3. Creamos un Service Account (como un usuario robot)
4. Descargamos el JSON con las credenciales
5. Compartimos la planilla con el email del Service Account

```
Service Account: bot-sheets@proyecto.iam.gserviceaccount.com
                   │
                   └──▶ Compartir planilla como Editor
```

**Importante**: Si no compartís la planilla con el Service Account, vas a ver error 403.

---

## El código de operaciones

En `src/sheets/operations.ts`:

```typescript
export async function appendRow(
  spreadsheetId: string,
  sheet: SheetConfig,
  values: string[]
) {
  const auth = await getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheet.name}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] }
  });
}
```

---

## Estado conversacional (la tabla oculta)

Cuando el usuario no proporciona todos los campos, necesitamos **recordar** lo que ya tenemos y preguntar por lo que falta.

Guardamos ese estado en una **hoja oculta**: `_state`.

```
┌─────────────────────────────────────────────────────────────┐
│ _state (hoja oculta)                                       │
├─────────────────────────────────────────────────────────────┤
│ chatId      sheetName  timestamp        partialData        │
│ 1369524005  Ventas     2025-01-15...   {"Cliente":"María"}│
└─────────────────────────────────────────────────────────────┘
```

Cada 5 minutos (TTL configurable), el estado expira y se limpia.

---

## La idea clave de esta ola

> **Google Sheets es nuestra base de datos. Usamos la API oficial googleapis para leer y escribir. La planilla se comparte con un "robot" (Service Account) que tiene permisos de editor. Cuando faltan datos, usamos una hoja oculta (_state) para guardar progreso temporal.**

---

## Próxima ola

**OLA 7: Terraform** — ¿Cómo desplegamos todo esto a producción?
