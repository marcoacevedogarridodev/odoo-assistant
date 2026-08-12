// api/ask-gemini.js — variante usando la API gratuita de Google Gemini
// Función serverless de Vercel. Corre en el servidor, así que la API key
// de Gemini nunca queda expuesta al navegador.
// Conseguí una key gratis en https://aistudio.google.com/apikey (no pide tarjeta)
//
// FIX (ago 2026): el modelo "gemini-flash-latest" ahora resuelve a Gemini 3.5
// Flash, que es un modelo de razonamiento: gasta tokens internos "pensando"
// antes de escribir la respuesta. Con maxOutputTokens bajo y sin controlar el
// thinking, ese presupuesto se lo comía el pensamiento interno y no quedaba
// nada para la respuesta -> por eso llegaba cortada o vacía.
// Se fija el modelo a una versión estable (no al alias "-latest", que puede
// cambiar de un día para el otro) y se sube el límite de tokens de salida.

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

// Modelo fijo (NO usar el alias "-latest": Google lo puede apuntar a un modelo
// distinto sin avisar, y eso fue justamente lo que rompió esto). Gemini 3.5
// Flash-Lite es GA, rápido y barato, ideal para este caso de uso.
// gemini-2.5-flash-lite se apaga el 16/oct/2026, así que no conviene volver a él.
const MODEL = 'gemini-3.5-flash-lite';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Falta configurar GEMINI_API_KEY en Vercel' });
    return;
  }

  const { transcript, odooContext } = req.body || {};

  if (!transcript || typeof transcript !== 'string') {
    res.status(400).json({ error: 'Falta el campo "transcript"' });
    return;
  }

  const contextText = odooContext && odooContext.trim() ? odooContext : '(sin contenido cargado todavía)';
  const systemPrompt = SYSTEM_PROMPT_PREFIX + contextText;

  // Log server-side para diagnosticar en Vercel > Deployments > Logs
  console.log('[ask-gemini] transcript:', transcript.slice(0, 200));
  console.log('[ask-gemini] contextText length (chars):', contextText.length);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: transcript }] }],
          generationConfig: {
            // Margen generoso: en modelos 3.x parte de esto se usa para el
            // razonamiento interno antes de escribir la respuesta visible.
            maxOutputTokens: 2048,
            // Gemini 3.x reemplazó "thinkingBudget" por "thinkingLevel".
            // "low" alcanza de sobra para responder preguntas puntuales de
            // Odoo y deja más presupuesto libre para el texto de salida.
            thinkingConfig: { thinkingLevel: 'low' },
          },
        }),
      }
    );

    const rawText = await response.text();

    if (!response.ok) {
      console.error('[ask-gemini] Gemini error', response.status, rawText);
      res.status(response.status).json({
        error: 'Error de la API de Gemini',
        detail: rawText,
      });
      return;
    }

    const data = JSON.parse(rawText);
    const candidate = data.candidates?.[0];
    const finishReason = candidate?.finishReason;
    const blockReason = data.promptFeedback?.blockReason;

    if (blockReason) {
      console.warn('[ask-gemini] Prompt bloqueado por seguridad:', blockReason);
      res.status(200).json({
        error: 'La pregunta fue bloqueada por el filtro de seguridad de Gemini',
        detail: blockReason,
      });
      return;
    }

    // Un candidate puede tener varias "parts" (a veces la primera es el
    // razonamiento interno y la respuesta real viene en otra). Concatenamos
    // todo el texto en vez de quedarnos solo con parts[0].
    const answer = (candidate?.content?.parts || [])
      .map((p) => p.text || '')
      .join('')
      .trim();

    if (finishReason === 'MAX_TOKENS') {
      console.warn('[ask-gemini] Respuesta cortada por límite de tokens');
    }
    if (!answer) {
      console.warn('[ask-gemini] Respuesta vacía. Payload completo:', rawText.slice(0, 800));
    }

    res.status(200).json({ answer, finishReason });
  } catch (err) {
    console.error('[ask-gemini] Excepción al llamar a la API', err);
    res.status(500).json({ error: 'Fallo al llamar a la API', detail: String(err) });
  }
}