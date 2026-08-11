// api/ask-openai.js — variante usando la API de OpenAI en vez de Anthropic
// Función serverless de Vercel. Corre en el servidor, así que la API key
// de OpenAI nunca queda expuesta al navegador.

const SYSTEM_PROMPT_PREFIX = `Sos un asistente experto en Odoo 19 que ayuda en tiempo real durante una reunión.
Vas a recibir fragmentos de una transcripción de audio (puede tener errores de reconocimiento
de voz, cortes o ruido). Tu trabajo:

1. Si el texto contiene una pregunta o pedido de información sobre Odoo 19, respondé de forma
   breve, clara y directa (máximo 4-5 líneas), usando SOLO la guía de Odoo 19 de abajo como fuente.
2. Si no hay ninguna pregunta clara en el texto (es solo charla, ruido, o una frase incompleta),
   respondé exactamente: "SIN_PREGUNTA"
3. Nunca inventes funcionalidades de Odoo que no estén en la guía. Si la guía no cubre el tema,
   decilo explícitamente.

--- GUÍA DE ODOO 19 (contexto fijo) ---
`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Falta configurar OPENAI_API_KEY en Vercel' });
    return;
  }

  const { transcript, odooContext } = req.body || {};

  if (!transcript || typeof transcript !== 'string') {
    res.status(400).json({ error: 'Falta el campo "transcript"' });
    return;
  }

  const systemPrompt =
    SYSTEM_PROMPT_PREFIX + (odooContext && odooContext.trim() ? odooContext : '(sin contenido cargado todavía)');

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 400,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(response.status).json({ error: 'Error de la API de OpenAI', detail: errText });
      return;
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || '';

    res.status(200).json({ answer });
  } catch (err) {
    res.status(500).json({ error: 'Fallo al llamar a la API', detail: String(err) });
  }
}
