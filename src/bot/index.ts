import { Bot } from 'grammy';
import { config as envConfig } from '../config.js';
import { config as botConfig, buildExtractionSchema, resolveSystemPrompt, buildSheetRow, fillConfirmationTemplate, findMissingFields } from '../config/index.js';
import { extractData } from '../ai/extract.js';
import { appendRow } from '../sheets/operations.js';
import { getState, saveState, clearState } from '../state/index.js';

export function createBot(): Bot {
  const bot = new Bot(envConfig.TELEGRAM_BOT_TOKEN, {
    botInfo: {
      id: 8502029031,
      is_bot: true,
      first_name: 'BotSheetsGoogle',
      username: 'GoogleSheetsNachoTest150397_bot',
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
    } as any,
  });

  // For now, we use the first configured sheet as the default target
  const targetSheet = botConfig.sheets[0];
  const spreadsheetId = botConfig.spreadsheetId;

  // /start command
  bot.command('start', async (ctx) => {
    await ctx.reply(botConfig.messages.welcome);
  });

  // Text messages
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text;
    const chatId = String(ctx.chat.id);

    try {
      await ctx.api.sendChatAction(ctx.chat.id, 'typing');

      // -------------------------------------------------------
      // 1. Check if there's a pending conversation (missing fields)
      // -------------------------------------------------------
      const pendingState = await getState(
        spreadsheetId,
        botConfig.conversation,
        chatId,
        targetSheet.name,
      );

      if (pendingState) {
        await handlePendingState(ctx, chatId, text, pendingState.partialData);
        return;
      }

      // -------------------------------------------------------
      // 2. Fresh message — extract data with AI
      // -------------------------------------------------------
      const schema = buildExtractionSchema(targetSheet);
      const systemPrompt = resolveSystemPrompt(botConfig, targetSheet);

      const { data: extracted, modelUsed } = await extractData({
        message: text,
        systemPrompt,
        schema,
        aiConfig: botConfig.ai,
      });

      console.log(`[AI] Extracted with ${modelUsed}:`, JSON.stringify(extracted));

      // -------------------------------------------------------
      // 3. Check for missing required fields
      // -------------------------------------------------------
      const missing = findMissingFields(targetSheet, extracted);

      if (missing.length > 0 && botConfig.conversation.askForMissing) {
        // Save partial state and ask for the first missing field
        await saveState(spreadsheetId, botConfig.conversation, {
          chatId,
          sheetName: targetSheet.name,
          partialData: extracted,
          timestamp: new Date().toISOString(),
        });

        const firstMissing = missing[0];
        await ctx.reply(`¿${firstMissing.description}?`);
        return;
      }

      // -------------------------------------------------------
      // 4. All fields complete — append to sheet
      // -------------------------------------------------------
      await completeAndAppend(ctx, chatId, extracted);

    } catch (error) {
      console.error('[Bot] Error processing message:', error);
      await ctx.reply(botConfig.messages.error);
    }
  });

  // Voice messages (transcribe → process as text)
  bot.on('message:voice', async (ctx) => {
    const voice = ctx.message.voice;

    try {
      await ctx.api.sendChatAction(ctx.chat.id, 'typing');

      const file = await ctx.api.getFile(voice.file_id);
      if (!file.file_path) {
        await ctx.reply('No pude descargar el audio.');
        return;
      }

      const audioUrl = `https://api.telegram.org/file/bot${envConfig.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
      const audioResponse = await fetch(audioUrl);
      const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

      // Lazy import to avoid loading transcribe module when not needed
      const { transcribeAudio } = await import('../ai/transcribe.js');
      const mimeType = voice.mime_type ?? 'audio/ogg';
      const transcribedText = await transcribeAudio(audioBuffer, mimeType);

      await ctx.reply(`🎤 "${transcribedText}"`);

      // Now process the transcribed text through the same flow
      // Re-emit as a fake text update so the text handler processes it
      const chatId = String(ctx.chat.id);
      const schema = buildExtractionSchema(targetSheet);
      const systemPrompt = resolveSystemPrompt(botConfig, targetSheet);

      const { data: extracted, modelUsed } = await extractData({
        message: transcribedText,
        systemPrompt,
        schema,
        aiConfig: botConfig.ai,
      });

      console.log(`[AI] Extracted from voice with ${modelUsed}:`, JSON.stringify(extracted));

      const missing = findMissingFields(targetSheet, extracted);

      if (missing.length > 0 && botConfig.conversation.askForMissing) {
        await saveState(spreadsheetId, botConfig.conversation, {
          chatId,
          sheetName: targetSheet.name,
          partialData: extracted,
          timestamp: new Date().toISOString(),
        });

        const firstMissing = missing[0];
        await ctx.reply(`¿${firstMissing.description}?`);
        return;
      }

      await completeAndAppend(ctx, chatId, extracted);

    } catch (error) {
      console.error('[Bot] Error processing voice:', error);
      await ctx.reply(botConfig.messages.error);
    }
  });

  // -----------------------------------------------------------
  //  Helper: handle a pending conversation (filling missing fields)
  // -----------------------------------------------------------
  async function handlePendingState(
    ctx: any,
    chatId: string,
    userResponse: string,
    partialData: Record<string, unknown>,
  ): Promise<void> {
    // Find which fields are still missing
    const missing = findMissingFields(targetSheet, partialData);

    if (missing.length === 0) {
      // Shouldn't happen, but safety check
      await completeAndAppend(ctx, chatId, partialData);
      return;
    }

    const currentField = missing[0];

    // Check if user says they don't know
    const dontKnowPatterns = ['no sé', 'no se', 'nose', 'ns', 'ni idea', '-', 'no tengo idea', 'ninguno', 'ninguna'];
    const normalized = userResponse.trim().toLowerCase();
    const doesntKnow = dontKnowPatterns.some((p) => normalized === p || normalized.includes(p));

    if (doesntKnow) {
      partialData[currentField.name] = null; // Will be replaced by missingDefault in buildSheetRow
    } else {
      // Parse the response based on column type
      if (currentField.type === 'number') {
        // Extract number from response (e.g., "$5.000" → 5000)
        const cleaned = userResponse.replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        partialData[currentField.name] = isNaN(num) ? userResponse : num;
      } else {
        partialData[currentField.name] = userResponse.trim();
      }
    }

    // Check if there are still more missing fields
    const stillMissing = findMissingFields(targetSheet, partialData);

    if (stillMissing.length > 0) {
      // Update state and ask for next field
      await saveState(spreadsheetId, botConfig.conversation, {
        chatId,
        sheetName: targetSheet.name,
        partialData,
        timestamp: new Date().toISOString(),
      });

      const nextField = stillMissing[0];
      await ctx.reply(`¿${nextField.description}?`);
      return;
    }

    // All fields complete
    await completeAndAppend(ctx, chatId, partialData);
  }

  // -----------------------------------------------------------
  //  Helper: build row, append to sheet, confirm, clear state
  // -----------------------------------------------------------
  async function completeAndAppend(
    ctx: any,
    chatId: string,
    extracted: Record<string, unknown>,
  ): Promise<void> {
    const rowValues = buildSheetRow(
      targetSheet,
      extracted,
      botConfig.conversation.missingDefault,
    );

    await appendRow(spreadsheetId, targetSheet, rowValues);

    // Clear any pending state
    await clearState(spreadsheetId, botConfig.conversation, chatId, targetSheet.name);

    // Send confirmation
    const confirmation = fillConfirmationTemplate(
      botConfig.messages.confirmation,
      targetSheet,
      rowValues,
    );

    await ctx.reply(confirmation);
  }

  return bot;
}
