import { getSheetsClient } from './client.js';
import type { SheetConfig } from '../config/bot-config.schema.js';

// ============================================================
//  APPEND — Add a new row to the sheet
// ============================================================

/**
 * Appends a row of values to a sheet.
 * Values must be in column order (matching sheet.columns).
 */
export async function appendRow(
  spreadsheetId: string,
  sheet: SheetConfig,
  values: string[],
): Promise<void> {
  const sheets = getSheetsClient();
  const lastCol = columnIndexToLetter(sheet.columns.length - 1);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheet.name}!A:${lastCol}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [values],
    },
  });
}

// ============================================================
//  READ — Get all rows from the sheet (excluding header)
// ============================================================

export interface SheetRow {
  /** 1-indexed row number in the sheet (for updates/deletes) */
  rowIndex: number;
  /** Key-value pairs: column name → cell value */
  data: Record<string, string>;
}

/**
 * Reads all rows from a sheet and returns them as structured objects.
 * Row 0 is treated as the header and skipped.
 */
export async function readRows(
  spreadsheetId: string,
  sheet: SheetConfig,
): Promise<SheetRow[]> {
  const sheets = getSheetsClient();
  const lastCol = columnIndexToLetter(sheet.columns.length - 1);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheet.name}!A:${lastCol}`,
  });

  const rawRows = response.data.values || [];
  const rows: SheetRow[] = [];

  // Skip header (row 0)
  for (let i = 1; i < rawRows.length; i++) {
    const data: Record<string, string> = {};

    sheet.columns.forEach((col, colIndex) => {
      data[col.name] = rawRows[i][colIndex] ?? '';
    });

    rows.push({
      rowIndex: i + 1, // 1-indexed for Sheets API
      data,
    });
  }

  return rows;
}

// ============================================================
//  DELETE — Remove a row by its index
// ============================================================

/**
 * Deletes a row from a sheet by its 1-indexed row number.
 * Uses the Sheets batchUpdate API to delete the row structurally.
 */
export async function deleteRow(
  spreadsheetId: string,
  sheet: SheetConfig,
  rowIndex: number,
): Promise<void> {
  const sheets = getSheetsClient();

  // First we need the sheetId (numeric) — not the tab name
  const sheetId = await getSheetId(spreadsheetId, sheet.name);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1, // 0-indexed for batchUpdate
              endIndex: rowIndex,
            },
          },
        },
      ],
    },
  });
}

// ============================================================
//  Helpers
// ============================================================

/**
 * Gets the numeric sheetId for a tab name.
 * Needed for batchUpdate operations (delete, etc.).
 */
async function getSheetId(spreadsheetId: string, sheetName: string): Promise<number> {
  const sheets = getSheetsClient();

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  });

  const found = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === sheetName,
  );

  if (!found?.properties?.sheetId && found?.properties?.sheetId !== 0) {
    throw new Error(`Sheet "${sheetName}" not found in spreadsheet`);
  }

  return found.properties.sheetId;
}

/**
 * Converts a 0-based column index to a sheet letter.
 * 0 → A, 1 → B, ..., 25 → Z, 26 → AA
 */
function columnIndexToLetter(index: number): string {
  let letter = '';
  let i = index;

  while (i >= 0) {
    letter = String.fromCharCode((i % 26) + 65) + letter;
    i = Math.floor(i / 26) - 1;
  }

  return letter;
}
