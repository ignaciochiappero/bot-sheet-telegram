import { config } from '../config.js';

/**
 * Transcribe audio using Groq Whisper API directly (bypassing AI SDK).
 *
 * WHY: The @ai-sdk/groq package hardcodes the filename as "audio" (no extension)
 * when building the multipart form. Groq's API validates by file extension,
 * not MIME type, so it rejects the request with:
 *   "file must be one of the following types: [flac mp3 mp4 mpeg mpga m4a ogg opus wav webm]"
 *
 * Calling the API directly lets us control the filename.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string = 'audio/ogg',
): Promise<string> {
  // Map MIME types to file extensions Groq accepts
  const extensionMap: Record<string, string> = {
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'mp4',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/flac': 'flac',
    'audio/x-m4a': 'm4a',
  };

  const ext = extensionMap[mimeType] ?? 'ogg';

  const formData = new FormData();
  const file = new File([audioBuffer], `audio.${ext}`, { type: mimeType });
  formData.append('file', file);
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('language', 'es');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.GROQ_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq transcription failed (${response.status}): ${errorBody}`);
  }

  const result = await response.json() as { text: string };
  return result.text;
}
