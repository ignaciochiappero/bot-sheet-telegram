import 'dotenv/config';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.argv[2];
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

if (!TELEGRAM_TOKEN) {
  console.error('Error: TELEGRAM_BOT_TOKEN not set in .env');
  process.exit(1);
}

if (!WEBHOOK_URL) {
  console.error('Usage: tsx scripts/set-webhook.ts <lambda-function-url>');
  console.error('Example: tsx scripts/set-webhook.ts https://xxx.lambda-url.region.on.aws/');
  process.exit(1);
}

if (!WEBHOOK_SECRET) {
  console.error('Error: WEBHOOK_SECRET not set in .env');
  process.exit(1);
}

async function setWebhook() {
  const url = `${WEBHOOK_URL.replace(/\/$/, '')}/`;
  
  // Set webhook with secret token
  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: url,
        secret_token: WEBHOOK_SECRET,
      }),
    }
  );

  const result = await response.json();

  if (result.ok) {
    console.log('✅ Webhook set successfully!');
    console.log(`   URL: ${url}`);
  } else {
    console.error('❌ Failed to set webhook:', result.description);
    process.exit(1);
  }
}

setWebhook();
