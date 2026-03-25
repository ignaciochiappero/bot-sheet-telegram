import { experimental_transcribe as transcribe } from 'ai';
import { groq } from '@ai-sdk/groq';
import { config } from '../config.js';

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const result = await transcribe({
    model: groq.transcription('whisper-large-v3-turbo'),
    audio: audioBuffer,
    providerOptions: {
      groq: { language: 'es' },
    },
  });

  return result.text;
}
