import { getSheetsClient } from './client.js';
import { config } from '../config.js';

export interface SalesRecord {
  producto: string;
  fecha: string;
  precio: string;
}

export async function findProductInStock(productName: string): Promise<{
  rowIndex: number;
  producto: string;
  estado: string;
  precio: string;
} | null> {
  const sheets = getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.SPREADSHEET_ID,
    range: 'Stock!A:C',
  });

  const rows = response.data.values || [];

  // Row 0 is header, start from 1
  for (let i = 1; i < rows.length; i++) {
    const [producto, estado, precio] = rows[i];

    if (
      producto?.toLowerCase().includes(productName.toLowerCase()) &&
      estado?.toLowerCase() === 'disponible'
    ) {
      return {
        rowIndex: i + 1, // 1-indexed for Sheets API
        producto,
        estado,
        precio: precio || '0',
      };
    }
  }

  return null;
}

export async function markProductAsSold(rowIndex: number): Promise<void> {
  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.SPREADSHEET_ID,
    range: `Stock!B${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [['Vendido']],
    },
  });
}

export async function appendSale(record: SalesRecord): Promise<void> {
  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.SPREADSHEET_ID,
    range: 'Sales!A:C',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[record.producto, record.fecha, record.precio]],
    },
  });
}

export async function processSale(productName: string): Promise<{ success: boolean; message: string }> {
  const product = await findProductInStock(productName);

  if (!product) {
    return { success: false, message: `Producto "${productName}" no encontrado en stock o ya vendido.` };
  }

  // Mark as sold
  await markProductAsSold(product.rowIndex);

  // Append to sales
  const now = new Date().toISOString().split('T')[0];
  await appendSale({
    producto: product.producto,
    fecha: now,
    precio: product.precio,
  });

  return {
    success: true,
    message: `✅ Vendido: ${product.producto} - $${product.precio}`,
  };
}
