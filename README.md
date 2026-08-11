# Asistente Odoo 19 — guía de despliegue

## Qué es cada archivo
- `public/index.html` — la app que abrís en Chrome del Android (mic + respuestas)
- `api/ask.js` — función serverless que guarda tu API key de forma segura y llama a Claude
- `package.json` — para que Vercel detecte el proyecto

**Importante:** este es el motivo por el que el HTML solo no funcionaba en Vercel — la
API key de Anthropic no puede vivir en el navegador (cualquiera la vería con "ver código
fuente"). Por eso el pedido pasa primero por `api/ask.js`, que corre en el servidor.

## Elegí qué modelo usar (Anthropic u OpenAI)

Hay dos archivos en `api/`:
- `ask.js` → usa Claude (Anthropic)
- `ask-openai.js` → usa GPT-4o mini (OpenAI)

Se puede usar cualquiera de los dos, no ambos a la vez. Para usar OpenAI:
1. Borrá (o renombrá) `api/ask.js`
2. Renombrá `api/ask-openai.js` a `api/ask.js`
3. En el paso de variables de entorno de Vercel usá `OPENAI_API_KEY` en vez de `ANTHROPIC_API_KEY`

El frontend (`public/index.html`) no cambia en ningún caso — le habla a `/api/ask` sin importar
qué modelo hay detrás.

## Pasos para desplegar

1. **Conseguí una API key**
   - Anthropic: https://console.anthropic.com → API Keys → Create Key
   - OpenAI: https://platform.openai.com/api-keys → Create new secret key
   - Ambas son cuentas de pago por uso (no son la misma suscripción que Claude.ai o ChatGPT Plus)

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
