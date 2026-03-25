import { google } from 'googleapis';
import { config } from '../config.js';

let sheetsClient: ReturnType<typeof google.sheets> | null = null;

export function getSheetsClient() {
  if (sheetsClient) {
    return sheetsClient;
  }

  const credentials = JSON.parse(config.GOOGLE_SERVICE_ACCOUNT_JSON);

  const auth = new google.auth.JWT(
    credentials.client_email,
    undefined,
    credentials.private_key,
    ['https://www.googleapis.com/auth/spreadsheets'],
  );

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}
