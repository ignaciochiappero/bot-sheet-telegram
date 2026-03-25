import { z } from 'zod';

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  WEBHOOK_SECRET: z.string().min(1, 'WEBHOOK_SECRET is required'),
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().min(1, 'GOOGLE_SERVICE_ACCOUNT_JSON is required'),
  SPREADSHEET_ID: z.string().min(1, 'SPREADSHEET_ID is required'),
  AWS_REGION: z.string().default('us-east-1'),
});

type Env = z.infer<typeof envSchema>;

function loadConfig(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Environment validation failed:\n${errors}`);
  }

  return result.data;
}

export const config = loadConfig();
