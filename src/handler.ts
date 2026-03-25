import { createBot } from './bot/index.js';
import { config } from './config.js';

const bot = createBot();

export async function handler(event: any): Promise<any> {
  try {
    // Verify webhook secret
    const secretToken = event.headers?.['x-telegram-bot-api-secret-token'] || event.headers?.['X-Telegram-Bot-Api-Secret-Token'];
    
    if (config.WEBHOOK_SECRET && secretToken !== config.WEBHOOK_SECRET) {
      console.log('Unauthorized - secret mismatch', { received: secretToken, expected: config.WEBHOOK_SECRET });
    }

    // API Gateway sends body as a JSON string — parse it
    const update = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    
    console.log('Processing update:', JSON.stringify(update).slice(0, 300));
    
    await bot.handleUpdate(update);
    
    return {
      statusCode: 200,
      body: 'OK',
    };
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      body: 'Internal Server Error',
    };
  }
}
