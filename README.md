# Asistente Odoo 19 — guía de despliegue

## Qué es cada archivo
- `public/index.html` — la app que abrís en Chrome del Android (mic + respuestas)
- `api/ask.js` — función serverless que guarda tu API key de forma segura y llama a Claude
- `package.json` — para que Vercel detecte el proyecto

**Importante:** este es el motivo por el que el HTML solo no funcionaba en Vercel — la
API key de Anthropic no puede vivir en el navegador (cualquiera la vería con "ver código
fuente"). Por eso el pedido pasa primero por `api/ask.js`, que corre en el servidor.

## Elegí qué modelo usar (Anthropic, OpenAI o Gemini)

Hay tres archivos en `api/`:
- `ask.js` → usa Claude (Anthropic) — pago por uso
- `ask-openai.js` → usa GPT-4o mini (OpenAI) — pago por uso
- `ask-gemini.js` → usa Gemini 2.5 Flash (Google) — **tiene nivel gratuito, no pide tarjeta**

Se usa uno solo a la vez, el que quede nombrado `api/ask.js`. Para usar Gemini (recomendado
si no querés cargar tarjeta):
1. Borrá el `api/ask.js` que tengas puesto
2. Renombrá `api/ask-gemini.js` a `api/ask.js`
3. En Vercel, la variable de entorno tiene que llamarse `GEMINI_API_KEY`

El frontend (`public/index.html`) no cambia en ningún caso — le habla a `/api/ask` sin importar
qué modelo hay detrás.

## Pasos para desplegar

1. **Conseguí una API key**
   - Gemini (gratis, sin tarjeta): https://aistudio.google.com/apikey → Create API key
   - OpenAI (pago): https://platform.openai.com/api-keys → Create new secret key
   - Anthropic (pago): https://console.anthropic.com → API Keys → Create Key

2. **Subí esta carpeta a un repo de GitHub** (o arrastrala directo a Vercel si preferís)

3. **En Vercel**
   - "Add New Project" → importá el repo (o el folder)
   - Vercel va a detectar `api/ask.js` como función serverless automáticamente
   - Andá a Project Settings → Environment Variables → agregá:
     - `ANTHROPIC_API_KEY` = tu key del paso 1
   - Deploy

4. **En tu Android**
   - Abrí la URL que te da Vercel (algo como `tu-proyecto.vercel.app`) **en Chrome**
     (el reconocimiento de voz en tiempo real no anda en otros navegadores de Android)
   - Dale permiso de micrófono
   - Tocá "Contexto" arriba y pegá el texto de tu guía de Odoo 19, tocá "Guardar
     contexto" (queda guardado en el celular, no hace falta pegarlo de nuevo)
   - Tocá el botón del micrófono y acercá el celular al parlante de la laptop

## Notas
- El costo es por uso de la API (tokens), no hay suscripción fija — con uso moderado
  suele ser centavos de dólar por sesión.
- Si el reconocimiento de voz se corta seguido, es una limitación de Chrome/Android
  (reinicia solo cada ~60s), la app ya lo maneja reiniciando automáticamente.
- Grabar/transcribir una reunión sin avisar a los participantes puede no ser legal según
  la jurisdicción — conviene avisar antes de usarlo en una llamada real.
