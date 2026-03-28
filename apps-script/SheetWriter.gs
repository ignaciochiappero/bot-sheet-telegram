// =============================================================
//  SHEETWRITER.GS — Escritura en Google Sheets + Notificacion Telegram
// =============================================================

/**
 * Escribe una venta de Empretienda en la hoja VENTAS.
 * Retorna true si se escribio, false si ya existia (duplicado).
 *
 * @param {Object} orderData - Objeto retornado por parseEmpretiendaEmail()
 * @returns {boolean}
 */
function writeToVentas(orderData) {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(VENTAS_SHEET);

  if (!sheet) {
    throw new Error("No se encontro la hoja '" + VENTAS_SHEET + "' en el spreadsheet.");
  }

  // Chequeo de duplicado por Pedido #
  if (orderData.orderNumber && isDuplicateOrder(sheet, orderData.orderNumber)) {
    return false;
  }

  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

  // Construir fila en el orden de VENTAS_COLUMNS:
  // Fecha | Clienta/e | Prendas | Monto $ | Tipo Pago | Medida | Color |
  // Origen | Pedido # | Email Cliente | Telefono | DNI | Direccion
  var row = [
    today,
    orderData.customerName   || "-",
    orderData.productNames   || "-",
    orderData.totalAmount    || 0,
    orderData.paymentMethod  || "-",
    orderData.productSize    || "-",
    orderData.productColors  || "-",
    "Empretienda",
    orderData.orderNumber    || "-",
    orderData.customerEmail  || "-",
    orderData.customerPhone  || "-",
    orderData.customerDni    || "-",
    orderData.address        || "-",
  ];

  sheet.appendRow(row);
  return true;
}

/**
 * Verifica si ya existe una fila con el mismo numero de orden en la hoja.
 * La columna "Pedido #" es la columna I (indice 8, base 0).
 */
function isDuplicateOrder(sheet, orderNumber) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false; // Solo hay header o esta vacia

  // Columna I = indice 9 en getRange (base 1)
  var pedidoCol = VENTAS_COLUMNS.indexOf("Pedido #") + 1;
  if (pedidoCol === 0) return false;

  var values = sheet.getRange(2, pedidoCol, lastRow - 1, 1).getValues();

  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim() === String(orderNumber).trim()) {
      return true;
    }
  }
  return false;
}

// -------------------------------------------------------------
//  Notificacion Telegram
// -------------------------------------------------------------

/**
 * Envia una notificacion al owner del bot por Telegram.
 * Requiere BOT_TOKEN y OWNER_CHAT_ID en Script Properties.
 */
function notifyTelegram(orderData) {
  var props   = PropertiesService.getScriptProperties();
  var token   = props.getProperty("BOT_TOKEN");
  var chatId  = props.getProperty("OWNER_CHAT_ID");

  if (!token || !chatId) {
    Logger.log("BOT_TOKEN o OWNER_CHAT_ID no configurados en Script Properties. Saltando notificacion.");
    return;
  }

  var monto = orderData.totalAmount ? "$" + orderData.totalAmount.toLocaleString("es-AR") : "-";
  var text = [
    "Nueva venta Empretienda!",
    "Orden #" + (orderData.orderNumber || "-"),
    "Cliente: " + (orderData.customerName || "-"),
    "Producto: " + (orderData.productNames || "-"),
    "Monto: " + monto,
    "Pago: " + (orderData.paymentMethod || "-"),
    "Envio: " + (orderData.shippingMethod || "-"),
  ].join("\n");

  var url     = "https://api.telegram.org/bot" + token + "/sendMessage";
  var payload = JSON.stringify({ chat_id: chatId, text: text });

  var options = {
    method: "post",
    contentType: "application/json",
    payload: payload,
    muteHttpExceptions: true,
  };

  var response = UrlFetchApp.fetch(url, options);
  var code     = response.getResponseCode();

  if (code !== 200) {
    Logger.log("Error al notificar por Telegram (HTTP " + code + "): " + response.getContentText());
  } else {
    Logger.log("Notificacion Telegram enviada para orden #" + orderData.orderNumber);
  }
}
