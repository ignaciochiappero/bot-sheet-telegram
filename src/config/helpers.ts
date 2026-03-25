import { z } from 'zod';
import type { SheetConfig, ColumnConfig, BotConfig } from './bot-config.schema.js';

/**
 * Builds a Zod schema dynamically from the column definitions.
 * Used with AI SDK's Output.object() to get structured extraction.
 *
 * Only includes columns that the AI needs to extract
 * (skips autoFill columns to save tokens).
 */
export function buildExtractionSchema(sheet: SheetConfig): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const col of sheet.columns) {
    // Skip auto-filled columns — the AI doesn't need to extract these
    if (col.autoFill) continue;

    let field: z.ZodTypeAny;

    switch (col.type) {
      case 'number':
        field = z.number().describe(col.description);
        break;
      case 'date':
        field = z.string().describe(col.description);
        break;
      case 'string':
      default:
        field = z.string().describe(col.description);
        break;
    }

    // If not required, make nullable so AI can return null for missing data
    if (!col.required) {
      field = field.nullable();
    }

    shape[col.name] = field;
  }

  return z.object(shape);
}

/**
 * Returns only the columns that the AI should extract (not auto-filled).
 */
export function getExtractableColumns(sheet: SheetConfig): ColumnConfig[] {
  return sheet.columns.filter((col) => !col.autoFill);
}

/**
 * Generates a system prompt from the column definitions.
 * Keeps it minimal to save tokens.
 */
export function generateSystemPrompt(sheet: SheetConfig): string {
  const extractable = getExtractableColumns(sheet);

  const fieldList = extractable
    .map((col) => {
      const req = col.required ? 'obligatorio' : 'opcional';
      return `- ${col.name} (${col.type}, ${req}): ${col.description}`;
    })
    .join('\n');

  return `Extraé los siguientes datos del mensaje del usuario.
Si un dato no está presente, devolvé null para ese campo.
Respondé SOLO con los datos estructurados, sin texto adicional.

Campos:
${fieldList}`;
}

/**
 * Resolves the system prompt: uses custom if provided, otherwise auto-generates.
 */
export function resolveSystemPrompt(config: BotConfig, sheet: SheetConfig): string {
  return config.ai.systemPrompt ?? generateSystemPrompt(sheet);
}

/**
 * Fills auto-fill columns with their resolved values.
 */
export function resolveAutoFillValues(sheet: SheetConfig): Record<string, string> {
  const values: Record<string, string> = {};

  for (const col of sheet.columns) {
    if (!col.autoFill) continue;

    if (col.autoFill === 'today') {
      values[col.name] = new Date().toISOString().split('T')[0];
    } else {
      values[col.name] = col.autoFill;
    }
  }

  return values;
}

/**
 * Builds a complete row (array of values) in column order,
 * merging AI-extracted data with auto-filled values.
 */
export function buildSheetRow(
  sheet: SheetConfig,
  extracted: Record<string, unknown>,
  missingDefault: string,
): string[] {
  const autoFilled = resolveAutoFillValues(sheet);

  return sheet.columns.map((col) => {
    // Auto-filled columns take priority
    if (col.autoFill && autoFilled[col.name] !== undefined) {
      return autoFilled[col.name];
    }

    const value = extracted[col.name];

    if (value === null || value === undefined) {
      return missingDefault;
    }

    return String(value);
  });
}

/**
 * Fills the confirmation message template with actual values.
 * Replaces {{Column Name}} placeholders.
 */
export function fillConfirmationTemplate(
  template: string,
  sheet: SheetConfig,
  rowValues: string[],
): string {
  let result = template;

  sheet.columns.forEach((col, index) => {
    result = result.replace(new RegExp(`\\{\\{${escapeRegex(col.name)}\\}\\}`, 'g'), rowValues[index]);
  });

  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Given AI extraction results, returns which required fields are missing.
 */
export function findMissingFields(
  sheet: SheetConfig,
  extracted: Record<string, unknown>,
): ColumnConfig[] {
  return getExtractableColumns(sheet).filter(
    (col) => col.required && (extracted[col.name] === null || extracted[col.name] === undefined),
  );
}
