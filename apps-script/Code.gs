// =============================================================
//  CODE.GS — Orquestador principal
// =============================================================

/**
 * Funcion principal. Se ejecuta via trigger cada 15 minutos.
 * Busca emails nuevos de Empretienda, los parsea y registra en VENTAS.
 */
function processEmpretiendaEmails() {
  var query = 'from:' + SENDER_EMAIL + ' subject:"nueva orden" -label:' + LABEL_PROCESSED + ' -label:' + LABEL_ERROR;
  var threads = GmailApp.search(query);

  if (threads.length === 0) {
    Logger.log("No hay emails nuevos de Empretienda.");
    return;
  }

  Logger.log("Emails nuevos encontrados: " + threads.length);

  var processedLabel = getOrCreateLabel(LABEL_PROCESSED);
  var errorLabel = getOrCreateLabel(LABEL_ERROR);

  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    var messages = thread.getMessages();

    for (var j = 0; j < messages.length; j++) {
      var message = messages[j];

      try {
        // Usamos el HTML directo — es la fuente estructurada mas confiable
        var html = message.getBody();
        if (!html || html.trim() === "") {
          Logger.log("Email sin cuerpo HTML, saltando.");
          continue;
        }

        var orderData = parseEmpretiendaEmail(html);
        Logger.log("Email parseado — Orden #" + orderData.orderNumber + " | Cliente: " + orderData.customerName);

        var written = writeToVentas(orderData);

        if (written) {
          notifyTelegram(orderData);
          Logger.log("Orden #" + orderData.orderNumber + " registrada exitosamente.");
        } else {
          Logger.log("Orden #" + orderData.orderNumber + " ya existia en la hoja. Saltando.");
        }

        thread.addLabel(processedLabel);
        break; // Un thread = una orden, no seguir con los demas mensajes

      } catch (e) {
        Logger.log("ERROR procesando email: " + e.message);
        Logger.log("Stack: " + e.stack);
        thread.addLabel(errorLabel);
        break;
      }
    }
  }
}

/**
 * Configura el trigger para correr cada 15 minutos.
 * Correr esta funcion UNA SOLA VEZ desde el editor para activar el trigger.
 */
function setupTrigger() {
  // Eliminar triggers existentes de esta funcion para evitar duplicados
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "processEmpretiendaEmails") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("processEmpretiendaEmails")
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log("Trigger configurado: cada 15 minutos.");
}

/**
 * Crea los labels de Gmail si no existen.
 * Correr esta funcion UNA SOLA VEZ desde el editor.
 */
function createLabels() {
  getOrCreateLabel(LABEL_PROCESSED);
  getOrCreateLabel(LABEL_ERROR);
  Logger.log("Labels creados: " + LABEL_PROCESSED + ", " + LABEL_ERROR);
}

/**
 * Obtiene un label de Gmail por nombre, o lo crea si no existe.
 * Los labels con "/" se crean como anidados (ej: "Empretienda/Procesado").
 */
function getOrCreateLabel(name) {
  var label = GmailApp.getUserLabelByName(name);
  if (!label) {
    label = GmailApp.createLabel(name);
  }
  return label;
}

/**
 * Elimina tags HTML de un string.
 */
function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s{2,}/g, " ")
    .trim();
}
