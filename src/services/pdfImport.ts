import type { Exercise } from '../types';

export interface PdfFicha {
  name: string;
  emoji: string;
  exercises: Exercise[];
}

/**
 * Envia o PDF para a Netlify Function, que chama a API da Anthropic
 * com a API key no servidor (nunca exposta ao browser).
 */
export async function analyzePdfWithAI(file: File): Promise<PdfFicha[]> {
  const base64 = await new Promise<string>((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res((reader.result as string).split(',')[1]);
    reader.onerror = () => rej(new Error('Erro ao ler arquivo'));
    reader.readAsDataURL(file);
  });

  const response = await fetch('/.netlify/functions/analyze-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdfBase64: base64 })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Erro na análise: ${response.status}`);
  }

  const data = await response.json();
  if (!data.fichas || !Array.isArray(data.fichas) || data.fichas.length === 0) {
    throw new Error('Nenhuma ficha encontrada no PDF.');
  }
  return data.fichas as PdfFicha[];
}
