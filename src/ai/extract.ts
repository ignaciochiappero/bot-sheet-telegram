import { generateObject } from 'ai';
import { groq } from '@ai-sdk/groq';
import { z } from 'zod';

const productSchema = z.object({
  productName: z.string().describe('El nombre del producto mencionado en el mensaje'),
  confidence: z.enum(['high', 'medium', 'low']).describe('Nivel de confianza en la extracción'),
});

export interface ExtractionResult {
  productName: string;
  confidence: 'high' | 'medium' | 'low';
}

export async function extractProductName(text: string): Promise<ExtractionResult> {
  const result = await generateObject({
    model: groq('llama-3.1-8b-instant'),
    schema: productSchema,
    prompt: `Extrae el nombre del producto que el usuario quiere comprar del siguiente mensaje.
Responde solo con el producto, sin prepender texto adicional.

Mensaje: "${text}"`,
  });

  return result.object;
}
