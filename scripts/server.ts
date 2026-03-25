import 'dotenv/config';
import express from 'express';
import { createBot } from '../src/bot/index.js';
import { webhookCallback } from 'grammy';

const bot = createBot();
const handleUpdate = webhookCallback(bot, 'express');

const app = express();
app.use(express.json());

app.post('/webhook', async (req, res) => {
  try {
    await handleUpdate(req, res);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error');
  }
});

app.get('/', (req, res) => {
  res.send('Bot is running! Send a message to your Telegram bot.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhook`);
});
