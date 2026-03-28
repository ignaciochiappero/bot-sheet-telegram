// =============================================================
//  CONFIG
//  Editar estas constantes antes de deployar el script.
// =============================================================

// ID del spreadsheet (mismo que la env var SPREADSHEET_ID del bot)
var SPREADSHEET_ID = "TU_SPREADSHEET_ID_AQUI";

// Nombre de la hoja de ventas
var VENTAS_SHEET = "Ventas";

// Email del remitente de Empretienda
var SENDER_EMAIL = "notificaciones@empretienda.com";

// Labels de Gmail para marcar emails procesados / con error
var LABEL_PROCESSED = "Empretienda/Procesado";
var LABEL_ERROR = "Empretienda/Error";

// Orden de columnas en VENTAS (debe coincidir exactamente con el Google Sheet)
// A=Fecha, B=Clienta/e, C=Prendas, D=Monto $, E=Tipo Pago, F=Medida, G=Color,
// H=Origen, I=Pedido #, J=Email Cliente, K=Telefono, L=DNI, M=Direccion
var VENTAS_COLUMNS = [
  "Fecha",
  "Clienta/e",
  "Prendas",
  "Monto $",
  "Tipo Pago",
  "Medida",
  "Color",
  "Origen",
  "Pedido #",
  "Email Cliente",
  "Telefono",
  "DNI",
  "Direccion"
];

// Bot token y chat ID se leen desde Script Properties para no hardcodear credenciales.
// Configurarlos en: Apps Script editor → Configuracion del proyecto → Propiedades del script
// Claves: BOT_TOKEN, OWNER_CHAT_ID
