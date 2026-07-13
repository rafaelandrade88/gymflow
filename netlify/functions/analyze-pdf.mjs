// Proxy seguro para a API da Anthropic — a API key vive só no servidor.
// Configure ANTHROPIC_API_KEY nas variáveis de ambiente do Netlify.

const PROMPT = `Analise este PDF de treinos de academia e extraia as fichas de treino.
Retorne SOMENTE um JSON válido, sem texto extra, sem markdown, sem blocos de código.
Formato exato:
{
  "fichas": [
    {
      "name": "Treino A — Peito e Bíceps",
      "emoji": "💪",
      "exercises": [
        { "name": "Supino Inclinado", "group": "Peito", "sets": 3, "reps": "8-12", "weight": 0, "obs": "Observações opcionais" }
      ]
    }
  ]
}
Grupos musculares válidos: Peito, Costas, Ombro, Bíceps, Tríceps, Perna, Glúteo, Abdômen, Cardio, Outro.
Para o emoji escolha um adequado ao grupo principal da ficha: 💪🏋️🦵⚡🔥🤸
Extraia TODOS os treinos e exercícios encontrados no PDF.`;

export default async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Método não permitido' }, { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY não configurada no servidor.' }, { status: 500 });
  }

  let pdfBase64;
  try {
    ({ pdfBase64 } = await req.json());
  } catch {
    return Response.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }
  if (!pdfBase64 || typeof pdfBase64 !== 'string' || pdfBase64.length > 15_000_000) {
    return Response.json({ error: 'PDF ausente ou muito grande.' }, { status: 400 });
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: PROMPT }
        ]
      }]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    return Response.json(
      { error: err.error?.message || `Erro na API: ${response.status}` },
      { status: 502 }
    );
  }

  const data = await response.json();
  const rawText = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
  try {
    const parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
    return Response.json({ fichas: parsed.fichas || [] });
  } catch {
    return Response.json({ error: 'A IA retornou um formato inesperado. Tente novamente.' }, { status: 502 });
  }
};

export const config = { path: '/.netlify/functions/analyze-pdf' };
