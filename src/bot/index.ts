import { Bot } from 'grammy';
import { config } from '../config.js';
import { extractProductName } from '../ai/extract.js';
import { transcribeAudio } from '../ai/transcribe.js';
import { processSale } from '../sheets/operations.js';

export function createBot(): Bot {
  const bot = new Bot(config.TELEGRAM_BOT_TOKEN, {
    botInfo: {
      id: 8502029031,
      is_bot: true,
      first_name: 'BotSheetsGoogle',
      username: 'GoogleSheetsNachoTest150397_bot',
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
    },
  });

  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text;
    
    try {
      await ctx.api.sendChatAction(ctx.chat.id, 'typing');
      
      // Extract product name using LLM
      const extraction = await extractProductName(text);
      
      if (extraction.confidence === 'low') {
        await ctx.reply(`No pude entender qué producto querés. ¿Podés redactarlo de otra forma?`);
        return;
      }

      await ctx.reply(`Encontré: ${extraction.productName}. Procesando venta...`);

      // Process the sale
      const result = await processSale(extraction.productName);
      await ctx.reply(result.message);
      
    } catch (error) {
      console.error('Error processing text:', error);
      await ctx.reply('Ocurrió un error procesando tu solicitud. Intentalo de nuevo.');
    }
  });

  bot.on('message:voice', async (ctx) => {
    const voice = ctx.message.voice;
    
    try {
      await ctx.api.sendChatAction(ctx.chat.id, 'typing');
      
      // Get file from Telegram
      const file = await ctx.api.getFile(voice.file_id);
      
      if (!file.file_path) {
        await ctx.reply('No pude descargar el audio.');
        return;
      }

      // Download audio
      const audioUrl = `https://api.telegram.org/file/bot${config.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
      const audioResponse = await fetch(audioUrl);
      const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

      // Transcribe audio
      await ctx.reply('Transcribiendo audio...');
      const text = await transcribeAudio(audioBuffer);
      
      await ctx.reply(`Transcripción: "${text}"`);

      // Extract product
      await ctx.reply('Buscando producto...');
      const extraction = await extractProductName(text);
      
      if (extraction.confidence === 'low') {
        await ctx.reply(`No pude entender qué producto querés. ¿Podés enviarlo por texto?`);
        return;
      }

      await ctx.reply(`Encontré: ${extraction.productName}. Procesando venta...`);

      // Process sale
      const result = await processSale(extraction.productName);
      await ctx.reply(result.message);
      
    } catch (error) {
      console.error('Error processing voice:', error);
      await ctx.reply('Ocurrió un error procesando el audio. Intentalo de nuevo.');
    }
  });

  return bot;
}
