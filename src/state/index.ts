import { getSheetsClient } from '../sheets/client.js';
import type { ConversationConfig } from '../config/bot-config.schema.js';

/**
 * Conversation state stored in a hidden Google Sheets tab.
 *
 * Schema of the _state sheet:
 *   | chatId | sheetName | partialData (JSON) | timestamp (ISO) |
 */

export interface ConversationState {
  chatId: string;
  sheetName: string;
  partialData: Record<string, unknown>;
  timestamp: string;
}

const STATE_COLUMNS = ['chatId', 'sheetName', 'partialData', 'timestamp'];

// ============================================================
//  Ensure the _state sheet exists
// ============================================================

let stateSheetEnsured = false;

/**
 * Creates the _state sheet if it doesn't exist.
 * Called lazily on first state operation.
 */
async function ensureStateSheet(
  spreadsheetId: string,
  stateSheetName: string,
): Promise<void> {
  if (stateSheetEnsured) return;

  const sheets = getSheetsClient();

  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title',
    });

    const exists = spreadsheet.data.sheets?.some(
      (s) => s.properties?.title === stateSheetName,
    );

    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: { title: stateSheetName },
              },
            },
          ],
        },
      });

      // Write header row
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${stateSheetName}!A1:D1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [STATE_COLUMNS],
        },
      });
    }
  } catch (error) {
    // If sheet already exists (race condition), ignore
    const msg = error instanceof Error ? error.message : '';
    if (!msg.includes('already exists')) throw error;
  }

  stateSheetEnsured = true;
}

// ============================================================
//  GET — Retrieve conversation state for a chat
// ============================================================

/**
 * Gets the pending conversation state for a given chatId + sheetName.
 * Returns null if no state exists or if it has expired (TTL).
 */
export async function getState(
  spreadsheetId: string,
  convConfig: ConversationConfig,
  chatId: string,
  sheetName: string,
): Promise<ConversationState | null> {
  await ensureStateSheet(spreadsheetId, convConfig.stateSheetName);

  const sheets = getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${convConfig.stateSheetName}!A:D`,
  });

  const rows = response.data.values || [];

  // Skip header, search from bottom (most recent first)
  for (let i = rows.length - 1; i >= 1; i--) {
    const [rowChatId, rowSheetName, rawPartialData, rowTimestamp] = rows[i];

    if (rowChatId === chatId && rowSheetName === sheetName) {
      // Check TTL
      const timestamp = new Date(rowTimestamp);
      const now = new Date();
      const ageMinutes = (now.getTime() - timestamp.getTime()) / 1000 / 60;

      if (ageMinutes > convConfig.stateTtlMinutes) {
        // Expired — clean it up and return null
        await deleteStateRow(spreadsheetId, convConfig.stateSheetName, i + 1);
        return null;
      }

      return {
        chatId: rowChatId,
        sheetName: rowSheetName,
        partialData: JSON.parse(rawPartialData || '{}'),
        timestamp: rowTimestamp,
      };
    }
  }

  return null;
}

// ============================================================
//  SAVE — Save or update conversation state
// ============================================================

/**
 * Saves conversation state. If state already exists for this chat+sheet,
 * updates it. Otherwise appends a new row.
 */
export async function saveState(
  spreadsheetId: string,
  convConfig: ConversationConfig,
  state: ConversationState,
): Promise<void> {
  await ensureStateSheet(spreadsheetId, convConfig.stateSheetName);

  const sheets = getSheetsClient();

  // Check if state already exists for this chat
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${convConfig.stateSheetName}!A:D`,
  });

  const rows = response.data.values || [];
  let existingRowIndex: number | null = null;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === state.chatId && rows[i][1] === state.sheetName) {
      existingRowIndex = i + 1; // 1-indexed
      break;
    }
  }

  const rowData = [
    state.chatId,
    state.sheetName,
    JSON.stringify(state.partialData),
    state.timestamp,
  ];

  if (existingRowIndex) {
    // Update existing row
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${convConfig.stateSheetName}!A${existingRowIndex}:D${existingRowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [rowData] },
    });
  } else {
    // Append new row
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${convConfig.stateSheetName}!A:D`,
      valueInputOption: 'RAW',
      requestBody: { values: [rowData] },
    });
  }
}

// ============================================================
//  DELETE — Remove conversation state
// ============================================================

/**
 * Deletes conversation state for a chat+sheet after successful completion.
 */
export async function clearState(
  spreadsheetId: string,
  convConfig: ConversationConfig,
  chatId: string,
  sheetName: string,
): Promise<void> {
  await ensureStateSheet(spreadsheetId, convConfig.stateSheetName);

  const sheets = getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${convConfig.stateSheetName}!A:D`,
  });

  const rows = response.data.values || [];

  // Find and delete from bottom to top (avoid index shifting)
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] === chatId && rows[i][1] === sheetName) {
      await deleteStateRow(spreadsheetId, convConfig.stateSheetName, i + 1);
    }
  }
}

// ============================================================
//  Internal helper
// ============================================================

async function deleteStateRow(
  spreadsheetId: string,
  stateSheetName: string,
  rowIndex: number,
): Promise<void> {
  const sheets = getSheetsClient();

  // Get numeric sheetId
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  });

  const found = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === stateSheetName,
  );

  if (!found?.properties?.sheetId && found?.properties?.sheetId !== 0) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: found.properties.sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        },
      ],
    },
  });
}
