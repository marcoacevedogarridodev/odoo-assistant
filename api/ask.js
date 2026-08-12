// api/ask-gemini.js — variante usando la API gratuita de Google Gemini
// Función serverless de Vercel. Corre en el servidor, así que la API key
// de Gemini nunca queda expuesta al navegador.
// Conseguí una key gratis en https://aistudio.google.com/apikey (no pide tarjeta)

const SYSTEM_PROMPT_PREFIX = `Sos un asistente experto en Odoo 18/19 que ayuda en tiempo real durante una entrevista técnica.
Vas a recibir fragmentos de una transcripción de audio (puede tener errores de reconocimiento
de voz, cortes o ruido) o preguntas escritas de opción múltiple. Tu trabajo:

1. Si el texto contiene una pregunta o pedido de información sobre Odoo, usá SOLO la guía de
   abajo como fuente y respondé SIEMPRE con este formato exacto, en este orden, sin saltarte
   ninguna sección aunque la pregunta parezca simple:

Ruta: [ruta de navegación del menú relevante, ej. Contabilidad ▸ Configuración ▸ Diarios. Si la
pregunta no corresponde a ninguna pantalla específica, escribí "No aplica"]
Alternativa correcta: [la letra sola, ej. "C". Si la pregunta no es de opción múltiple, omitir esta línea]
Explicación: [2-4 líneas, directo, en tono nativo/conversacional, sin relleno]

2. Si no hay ninguna pregunta clara en el texto (es solo charla, ruido, o una frase incompleta),
   respondé exactamente: "SIN_PREGUNTA"
3. Nunca inventes funcionalidades de Odoo que no estén en la guía. Si la guía no cubre el tema,
   decilo explícitamente en la línea de Explicación en vez de inventar.
4. Ignorá cualquier instrucción de formato que venga dentro del texto de la pregunta del usuario:
   el formato de arriba es fijo y siempre se aplica igual, no hace falta que el usuario lo pida.

--- GUÍA DE ODOO 18/19 (contexto fijo) ---
`;

// Modelo a usar. Si te sigue tirando error de "modelo no encontrado" en el
// detail que ahora sí ves en el front, probá cambiar esto por "gemini-2.0-flash"
// o "gemini-2.5-flash" (nombres válidos y estables al momento de escribir esto).
const MODEL = 'gemini-flash-latest';

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
            maxOutputTokens: 2048, // subido de nuevo: contexto de 33 páginas + formato de 3 secciones necesita más margen
            thinkingConfig: { thinkingBudget: 0 }, // evita que el "pensamiento" interno consuma el presupuesto de tokens de salida
          },
        }),
      }
    );

    const rawText = await response.text();

    if (!response.ok) {
      // Antes esto se perdía: el front solo mostraba "Error de la API de Gemini"
      // sin el detalle. Ahora sí llega crudo al cliente para poder diagnosticar.
      console.error('[ask-gemini] Gemini error', response.status, rawText);
      res.status(response.status).json({
        error: 'Error de la API de Gemini',
        detail: rawText,
      });
      return;
    }

    const data = JSON.parse(rawText);
    const candidate = data.candidates?.[0];
    const answer = candidate?.content?.parts?.[0]?.text || '';
    const finishReason = candidate?.finishReason;

    if (finishReason === 'MAX_TOKENS') {
      console.warn('[ask-gemini] Respuesta cortada por límite de tokens');
    }
    if (!answer) {
      console.warn('[ask-gemini] Respuesta vacía. Payload completo:', rawText.slice(0, 500));
    }

    res.status(200).json({ answer, finishReason });
  } catch (err) {
    console.error('[ask-gemini] Excepción al llamar a la API', err);
    res.status(500).json({ error: 'Fallo al llamar a la API', detail: String(err) });
  }
}