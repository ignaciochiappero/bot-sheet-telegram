import type { BotConfig } from "./bot-config.schema.js";

/**
 * ============================================================
 *  BOT CONFIGURATION
 *  Edit this file to customize the bot for your use case.
 * ============================================================
 */
export const botConfig: BotConfig = {
  // --------------------------------------------------------
  // Google Spreadsheet
  // --------------------------------------------------------
  spreadsheetId: process.env.SPREADSHEET_ID || "YOUR_SPREADSHEET_ID",

  // --------------------------------------------------------
  // Sheets & Columns
  // --------------------------------------------------------
  sheets: [
    {
      name: "Ventas",
      actions: ["append"],
      columns: [
        {
          name: "Fecha",
          type: "date",
          required: false,
          description: "Fecha de la venta",
          autoFill: "today",
        },
        {
          name: "Clienta/e",
          type: "string",
          required: true,
          description: "Nombre de la persona que compró",
        },
        {
          name: "Prendas",
          type: "string",
          required: true,
          description: "Prendas o productos vendidos",
        },
        {
          name: "Monto $",
          type: "number",
          required: true,
          description: "Monto total de la venta en pesos",
        },
        {
          name: "Tipo Pago",
          type: "string",
          required: true,
          description: "Forma de pago (efectivo, transferencia, tarjeta, etc.)",
        },
        {
          name: "Medida",
          type: "string",
          required: true,
          description: "Talle de la prenda",
        },
        {
          name: "Color",
          type: "string",
          required: true,
          description: "Color de la prenda",
        },
        {
          name: "Origen",
          type: "string",
          required: false,
          description: "Origen de la venta",
          autoFill: "Manual",
        },
        {
          name: "Pedido #",
          type: "string",
          required: false,
          description: "Numero de pedido de Empretienda",
          autoFill: "-",
        },
        {
          name: "Email Cliente",
          type: "string",
          required: false,
          description: "Email del comprador",
          autoFill: "-",
        },
        {
          name: "Telefono",
          type: "string",
          required: false,
          description: "Telefono del comprador",
          autoFill: "-",
        },
        {
          name: "DNI",
          type: "string",
          required: false,
          description: "DNI del comprador",
          autoFill: "-",
        },
        {
          name: "Direccion",
          type: "string",
          required: false,
          description: "Direccion completa del comprador",
          autoFill: "-",
        },
      ],
    },
  ],

  // --------------------------------------------------------
  // AI Configuration
  // --------------------------------------------------------
  ai: {
    provider: "groq",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"],
    // systemPrompt is auto-generated from columns if omitted.
    // Uncomment to override:
    // systemPrompt: 'Sos un asistente que extrae datos de ventas...',
    temperature: 0.1,
  },

  // --------------------------------------------------------
  // Conversation Flow
  // --------------------------------------------------------
  conversation: {
    askForMissing: true,
    missingDefault: "-",
    stateTtlMinutes: 5,
    stateSheetName: "_state",
  },

  // --------------------------------------------------------
  // Bot Messages
  // --------------------------------------------------------
  messages: {
    welcome: "¡Hola! Enviame los datos de una venta y la registro.",
    confirmation:
      "✅ Registrado: {{Clienta/e}} — {{Prendas}} — ${{Monto $}} — {{Tipo Pago}} - {{Medida}} - {{Color}}",
    error: "Ocurrió un error procesando tu mensaje. Intentalo de nuevo.",
  },
};
