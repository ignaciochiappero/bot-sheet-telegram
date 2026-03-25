import 'dotenv/config';
import { getSheetsClient } from '../src/sheets/client.js';
import { config } from '../src/config.js';

async function debugSheets() {
  console.log('🔍 Debugging Google Sheets...\n');
  
  const sheets = getSheetsClient();
  const spreadsheetId = config.SPREADSHEET_ID;
  
  console.log(`Spreadsheet ID: ${spreadsheetId}\n`);
  
  // Get Stock sheet
  console.log('=== STOCK SHEET ===');
  try {
    const stockResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Stock!A:C',
    });
    
    const rows = stockResponse.data.values || [];
    console.log(`Total rows: ${rows.length}`);
    
    rows.forEach((row, i) => {
      console.log(`Row ${i}: ${JSON.stringify(row)}`);
    });
  } catch (e) {
    console.log('Error:', e);
  }
  
  console.log('\n=== SALES SHEET ===');
  try {
    const salesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sales!A:C',
    });
    
    const rows = salesResponse.data.values || [];
    console.log(`Total rows: ${rows.length}`);
    
    rows.forEach((row, i) => {
      console.log(`Row ${i}: ${JSON.stringify(row)}`);
    });
  } catch (e) {
    console.log('Error:', e);
  }
}

debugSheets().catch(console.error);
