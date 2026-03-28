// =============================================================
//  EMAILPARSER.GS — Parseo del email HTML de Empretienda
//  Trabaja directo con el HTML para tener datos estructurados.
// =============================================================

/**
 * Parsea el cuerpo HTML de un email de Empretienda.
 *
 * @param {string} html - Cuerpo HTML del email
 * @returns {Object} orderData con todos los campos extraidos
 */
function parseEmpretiendaEmail(html) {
  var products = extractProducts(html);

  return {
    orderNumber:   extractOrderNumber(html),
    paymentMethod: extractPaymentMethod(html),
    products:      products,
    customerName:  extractCustomerName(html),
    customerEmail: extractCustomerEmail(html),
    customerPhone: extractCustomerPhone(html),
    customerDni:   extractCustomerDni(html),
    address:       extractAddress(html),
    totalAmount:   extractTotalAmount(html),
    // Campos derivados para la hoja
    productNames:  deriveProductNames(products),
    productColors: deriveProductColors(products),
    productSize:   deriveProductSize(products),
  };
}

// -------------------------------------------------------------
//  Helpers
// -------------------------------------------------------------

/**
 * Extrae texto entre dos tags HTML usando regex.
 * Ejemplo: extractBetweenTags(html, "h2", "h3")
 *   busca <h2>...LABEL...</h2> y retorna el contenido del <h3> siguiente.
 */
function extractAfterHeading(html, headingText) {
  // Busca <h2>...headingText...</h2> seguido de <h3>...VALOR...</h3>
  var pattern = new RegExp(
    '<h2[^>]*>[^<]*' + escapeRegex(headingText) + '[^<]*</h2>\\s*<h3[^>]*>([^<]+)</h3>',
    'i'
  );
  var match = html.match(pattern);
  return match ? match[1].trim() : "";
}

/**
 * Extrae el contenido de texto de un tag <p> que empieza con un label.
 * Ejemplo: extractParagraphField(html, "Nombre") → "Ignacio"
 */
function extractParagraphField(html, label) {
  var pattern = new RegExp(
    '<p[^>]*>' + escapeRegex(label) + '\\s*:\\s*(?:<[^>]*>)*\\s*([^<]+)',
    'i'
  );
  var match = html.match(pattern);
  return match ? match[1].trim() : "";
}

/**
 * Igual que extractParagraphField pero el label ya es un patron regex (para acentos).
 */
function extractFieldFlexible(html, labelPattern) {
  var pattern = new RegExp(
    '<p[^>]*>' + labelPattern + '\\s*:\\s*(?:<[^>]*>)*\\s*([^<]+)',
    'i'
  );
  var match = html.match(pattern);
  return match ? match[1].trim() : "";
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripTags(str) {
  return str.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

// -------------------------------------------------------------
//  Numero de orden
// -------------------------------------------------------------

function extractOrderNumber(html) {
  var match = html.match(/Orden\s*[:#]\s*#?(\d+)/i);
  return match ? match[1].trim() : "";
}

// -------------------------------------------------------------
//  Metodo de pago + estado → "Transferencia (Pendiente)"
// -------------------------------------------------------------

function extractPaymentMethod(html) {
  var method = extractAfterHeading(html, "todo de pago");
  var status = extractAfterHeading(html, "Estado del pago");

  if (!method) return "-";
  if (status) return method + " (" + status + ")";
  return method;
}

// -------------------------------------------------------------
//  Monto total
// -------------------------------------------------------------

function extractTotalAmount(html) {
  // Buscar el ultimo bloque de precio que dice "Total" (no "Subtotal")
  // En el HTML: <p>$35000.00</p> ... <p>Total</p>
  var matches = html.match(/\$([\d.,]+)\s*<\/p>\s*<div[^>]*>\s*<p[^>]*>[\s\S]*?Total\s*<\/p>/i);
  if (matches) {
    return parseEmpretiendaPrice(matches[1]);
  }

  // Fallback: buscar el ultimo "$PRECIO" antes de "Total"
  var totalSection = html.match(/\$([\d.,]+)[\s\S]*?<p[^>]*>\s*Total\s*<\/p>/i);
  if (totalSection) {
    return parseEmpretiendaPrice(totalSection[1]);
  }

  return 0;
}

/**
 * Parsea un precio de Empretienda.
 * Formato: "35000.00" (punto como decimal, sin separador de miles).
 */
function parseEmpretiendaPrice(raw) {
  if (!raw) return 0;
  // Empretienda usa formato "35000.00" — punto es decimal
  return parseFloat(raw) || 0;
}

// -------------------------------------------------------------
//  Productos
// -------------------------------------------------------------

/**
 * Extrae productos del HTML.
 * Estructura en el email:
 *   <p>$35000.00</p>
 *   <p>1 x OXFORD Elastizado Plus Size</p>
 *   <p>SKU: -</p>
 *   <p>Color: Azúl Clásico</p>
 */
function extractProducts(html) {
  var products = [];

  // Buscar la seccion "Detalle de la venta" hasta "Datos de envío" o "Subtotal"
  var sectionMatch = html.match(/Detalle de la venta[\s\S]*?(?=Subtotal|Datos de env)/i);
  if (!sectionMatch) return products;

  var section = sectionMatch[0];

  // Buscar bloques de producto: "N x NOMBRE"
  var productRegex = /<p[^>]*>\s*(\d+)\s*x\s*([^<]+)<\/p>/gi;
  var match;

  while ((match = productRegex.exec(section)) !== null) {
    var qty  = parseInt(match[1], 10) || 1;
    var name = match[2].trim();

    // Buscar color despues de este producto (dentro de los proximos 500 chars)
    var afterProduct = section.substring(match.index, match.index + 500);
    var colorMatch = afterProduct.match(/Color\s*:\s*([^<]+)/i);
    var color = colorMatch ? colorMatch[1].trim() : "";

    // Buscar precio antes de este producto (el $XXXXX.XX que aparece antes)
    var beforeProduct = section.substring(0, match.index);
    var priceMatches = beforeProduct.match(/\$([\d.,]+)/g);
    var price = 0;
    if (priceMatches && priceMatches.length > 0) {
      var lastPrice = priceMatches[priceMatches.length - 1].replace("$", "");
      price = parseEmpretiendaPrice(lastPrice);
    }

    products.push({ qty: qty, name: name, color: color, price: price });
  }

  return products;
}

/**
 * Retorna nombres de productos joinados con " + ".
 */
function deriveProductNames(products) {
  if (products.length === 0) return "-";
  return products.map(function(p) {
    return (p.qty > 1 ? p.qty + "x " : "") + p.name;
  }).join(" + ");
}

/**
 * Retorna colores de productos.
 */
function deriveProductColors(products) {
  if (products.length === 0) return "-";
  var colors = products
    .map(function(p) { return p.color; })
    .filter(function(c) { return c !== ""; });
  if (colors.length === 0) return "-";
  var unique = colors.filter(function(c, idx) { return colors.indexOf(c) === idx; });
  return unique.join(" / ");
}

/**
 * Intenta extraer talle del nombre del producto.
 */
function deriveProductSize(products) {
  if (products.length === 0) return "-";

  var sizePatterns = [
    /\b(XXL|XL|XS|X{1,3}L)\b/i,
    /\b(Plus\s*Size)\b/i,
    /\b(talle\s*\d+)\b/i,
    /\b([SML])\b/,
  ];

  for (var i = 0; i < products.length; i++) {
    var name = products[i].name;
    for (var j = 0; j < sizePatterns.length; j++) {
      var m = name.match(sizePatterns[j]);
      if (m) return m[1];
    }
  }
  return "-";
}

// -------------------------------------------------------------
//  Datos del cliente — extraen de los <p> del HTML
// -------------------------------------------------------------

function extractCustomerName(html) {
  // Buscar en la seccion "Información del destinatario"
  var section = html.match(/Informaci[oó]n del destinatario[\s\S]*?(?=Datos para la facturaci|$)/i);
  if (!section) return "";

  var s = section[0];
  var nombre   = extractParagraphField(s, "Nombre");
  var apellido = extractParagraphField(s, "Apellido");

  if (nombre && apellido) return nombre + " " + apellido;
  if (nombre) return nombre;
  return "";
}

function extractCustomerEmail(html) {
  var section = html.match(/Informaci[oó]n del destinatario[\s\S]*?(?=Datos para la facturaci|$)/i);
  if (!section) return "-";
  // Email puede estar en un <a> tag
  var emailMatch = section[0].match(/Email\s*:\s*(?:<[^>]*>)*\s*([^<\s]+@[^<\s]+)/i);
  return emailMatch ? emailMatch[1].trim() : "-";
}

function extractCustomerPhone(html) {
  var section = html.match(/Informaci[oó]n del destinatario[\s\S]*?(?=Datos para la facturaci|$)/i);
  if (!section) return "-";
  // Buscar "Teléfono" con o sin acento, con posibles tags intermedios
  var phoneMatch = section[0].match(/Tel[eé]fono\s*:\s*(?:<[^>]*>)*\s*([^<\n]+)/i);
  return phoneMatch ? phoneMatch[1].trim() : "-";
}

function extractCustomerDni(html) {
  var section = html.match(/Informaci[oó]n del destinatario[\s\S]*?(?=Datos para la facturaci|$)/i);
  if (!section) return "-";
  return extractParagraphField(section[0], "DNI") || "-";
}

function extractAddress(html) {
  var section = html.match(/Datos para la facturaci[oó]n[\s\S]*?(?=Record[aá] que puedes|$)/i);
  if (!section) return "-";

  var s = section[0];
  var calle     = extractParagraphField(s, "Calle");
  var numero    = extractFieldFlexible(s, "N[uú]mero");
  var piso      = extractParagraphField(s, "Piso");
  var dpto      = extractParagraphField(s, "Dpto");
  var ciudad    = extractParagraphField(s, "Ciudad");
  var provincia = extractParagraphField(s, "Provincia");
  var cp        = extractFieldFlexible(s, "C[oó]digo postal");

  var parts = [];
  if (calle) {
    var street = calle;
    if (numero && numero !== "-") street += " " + numero;
    parts.push(street);
  }
  if (piso && piso !== "-")  parts.push("Piso " + piso);
  if (dpto && dpto !== "-")  parts.push("Dpto " + dpto);
  if (ciudad)    parts.push(ciudad);
  if (provincia) parts.push(provincia);
  if (cp)        parts.push("CP " + cp);

  return parts.length > 0 ? parts.join(", ") : "-";
}
