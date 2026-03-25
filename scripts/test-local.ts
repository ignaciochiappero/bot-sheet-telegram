import 'dotenv/config';
import { config } from '../src/config.js';
import { findProductInStock, processSale } from '../src/sheets/operations.js';
import { extractProductName } from '../src/ai/extract.js';

// Test the extraction
async function testExtraction() {
  console.log('🧪 Testing AI extraction...\n');
  
  const testMessages = [
    'Quiero comprar unas Zapatillas',
    'Me llevo un Buzo',
    'Tengo interés en la Campera',
  ];
  
  for (const msg of testMessages) {
    console.log(`Input: "${msg}"`);
    try {
      const result = await extractProductName(msg);
      console.log(`Output: ${result.productName} (confidence: ${result.confidence})\n`);
    } catch (e) {
      console.log(`Error: ${e}\n`);
    }
  }
}

// Test Sheets connection
async function testSheets() {
  console.log('🧪 Testing Google Sheets connection...\n');
  
  console.log(`Spreadsheet ID: ${config.SPREADSHEET_ID}`);
  
  try {
    const product = await findProductInStock('Zapatillas');
    if (product) {
      console.log(`✅ Found: ${product.producto} - ${product.estado} - $${product.precio}`);
    } else {
      console.log('❌ Product not found');
    }
  } catch (e) {
    console.log(`❌ Error: ${e}`);
  }
}

// Test full sale flow
async function testSale() {
  console.log('\n🧪 Testing full sale flow...\n');
  
  const testProduct = 'Zapatillas';
  console.log(`Processing sale for: ${testProduct}`);
  
  try {
    const result = await processSale(testProduct);
    console.log(`Result: ${result.message}`);
  } catch (e) {
    console.log(`Error: ${e}`);
  }
}

// Run tests
async function main() {
  console.log('======================================');
  console.log('   LOCAL TEST - Telegram Bot Sheets   ');
  console.log('======================================\n');
  
  console.log('Config loaded:', {
    TELEGRAM_BOT_TOKEN: config.TELEGRAM_BOT_TOKEN ? '✅ set' : '❌ missing',
    GROQ_API_KEY: config.GROQ_API_KEY ? '✅ set' : '❌ missing',
    SPREADSHEET_ID: config.SPREADSHEET_ID ? '✅ set' : '❌ missing',
    GOOGLE_SERVICE_ACCOUNT_JSON: config.GOOGLE_SERVICE_ACCOUNT_JSON ? '✅ set' : '❌ missing',
  });
  
  console.log('\n');
  
  // Test 1: AI extraction
  await testExtraction();
  
  // Test 2: Sheets connection
  await testSheets();
  
  // Test 3: Full sale
  await testSale();
  
  console.log('\n======================================');
  console.log('              DONE                    ');
  console.log('======================================');
}

main().catch(console.error);
