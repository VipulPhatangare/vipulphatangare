// Unified LLM helper. Every AI feature calls generateJSON()/generateText() here
// instead of talking to a provider SDK directly, so the model can be switched
// (Gemini ⇄ NVIDIA-hosted DeepSeek/Kimi) from one place. Routing is decided by the
// model's `provider` in config/aiModels.js.

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { OpenAI } = require('openai');
const { getModel, DEFAULT_MODEL, INHERIT } = require('../config/aiModels');
const ModelSettings = require('../models/ModelSettings');

// ── Provider clients (lazy singletons) ──────────────────────────────────────
let _gemini, _nvidia;
function gemini() {
  if (!_gemini) _gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return _gemini;
}
function nvidia() {
  if (!process.env.NVIDIA_API_KEY) {
    throw new Error('NVIDIA_API_KEY is not set — add it to backend/.env to use DeepSeek/Kimi models');
  }
  if (!_nvidia) {
    _nvidia = new OpenAI({
      apiKey: process.env.NVIDIA_API_KEY,
      baseURL: 'https://integrate.api.nvidia.com/v1',
      // Fail fast instead of hanging a request if a model has no serving capacity
      // (integrate.api.nvidia.com can stall on unavailable preview models).
      timeout: 120000,
      maxRetries: 1
    });
  }
  return _nvidia;
}

// Resolves a feature's stored modelName to a concrete model id. Empty/'inherit'
// means "use the project-wide global default".
async function resolveModel(explicit) {
  if (explicit && explicit !== INHERIT) return explicit;
  try {
    return await ModelSettings.getGlobalModel();
  } catch {
    return DEFAULT_MODEL;
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Best-effort repair of JSON cut off mid-response (reasoning models can truncate
// when their thinking tokens eat the output budget). Closes any dangling string,
// then open brackets/braces in order. Returns a parsed object or null.
function tryParseTruncatedJSON(raw) {
  try { return JSON.parse(raw); } catch { /* fall through to repair */ }

  let s = raw;
  const lastComma = s.lastIndexOf(',');
  const lastClose = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (lastComma > lastClose) s = s.slice(0, lastComma);

  const stack = [];
  let inStr = false, escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') stack.push(c);
    else if (c === '}' || c === ']') stack.pop();
  }
  if (inStr) s += '"';
  while (stack.length) s += stack.pop() === '{' ? '}' : ']';

  try { return JSON.parse(s); } catch { return null; }
}

function stripFences(raw) {
  return String(raw || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

// history is in Gemini shape: [{ role: 'user'|'model', parts: [{ text }] }]
function historyToOpenAI(history = []) {
  return history.map(h => ({
    role: h.role === 'model' ? 'assistant' : 'user',
    content: (h.parts || []).map(p => p.text || '').join('')
  }));
}

// ── Raw single-shot text call to a provider (no JSON parsing) ────────────────
async function rawCall(modelId, { system, prompt, history = [], temperature, maxTokens, json }) {
  const model = getModel(modelId);

  if (model.provider === 'gemini') {
    const gm = gemini().getGenerativeModel({
      model: model.id,
      ...(system ? { systemInstruction: system } : {}),
      generationConfig: {
        ...(maxTokens ? { maxOutputTokens: maxTokens } : {}),
        ...(temperature != null ? { temperature } : {}),
        ...(json ? { responseMimeType: 'application/json' } : {}),
        ...(json && json.responseSchema ? { responseSchema: json.responseSchema } : {})
      }
    });
    if (history.length) {
      const chat = gm.startChat({ history });
      const result = await chat.sendMessage(prompt);
      return result.response.text();
    }
    const result = await gm.generateContent(prompt);
    return result.response.text();
  }

  // NVIDIA (OpenAI-compatible) — DeepSeek & Kimi
  const messages = [
    ...(system ? [{ role: 'system', content: system }] : []),
    ...historyToOpenAI(history),
    { role: 'user', content: prompt }
  ];
  const completion = await nvidia().chat.completions.create({
    model: model.nvidiaModel,
    messages,
    ...(temperature != null ? { temperature } : {}),
    ...(maxTokens ? { max_tokens: maxTokens } : {}),
    ...(json ? { response_format: { type: 'json_object' } } : {}),
    ...(model.thinking != null
      ? { chat_template_kwargs: { thinking: model.thinking, reasoning_effort: model.reasoningEffort || 'high' } }
      : {}),
    stream: false
  });
  // Ignore any reasoning/reasoning_content — we only want the final answer.
  return completion.choices?.[0]?.message?.content || '';
}

// ── Public API ───────────────────────────────────────────────────────────────

// Returns a parsed JSON object. `responseSchema` is honoured by Gemini; NVIDIA
// models rely on json_object mode + the prompt's own JSON instructions, with the
// truncation-repair parser as a safety net.
async function generateJSON({ modelId, system = '', prompt, history = [], temperature = 0.6, maxTokens = 16384, responseSchema = null } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const raw = stripFences(await rawCall(modelId, {
        system, prompt, history, temperature, maxTokens,
        json: { responseSchema }
      }));
      const parsed = tryParseTruncatedJSON(raw);
      if (parsed !== null) return parsed;
      throw new Error('Unparseable JSON from model (even after repair)');
    } catch (err) {
      lastErr = err;
      console.warn(`[llm] generateJSON attempt ${attempt} (${modelId}) failed:`, err.message);
      if (attempt < 3) await sleep(attempt * 2000);
    }
  }
  throw new Error(`LLM JSON call failed (${modelId}): ${lastErr.message}`);
}

// Returns trimmed text. Pass `json: true` to request JSON-mode output but still
// get the raw string back (for callers that do their own parse-with-fallback,
// e.g. the chatbot's template detection).
async function generateText({ modelId, system = '', prompt, history = [], temperature = 0.6, maxTokens = 2048, json = false } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await rawCall(modelId, {
        system, prompt, history, temperature, maxTokens,
        json: json ? {} : undefined
      });
      return json ? stripFences(raw) : String(raw || '').trim();
    } catch (err) {
      lastErr = err;
      console.warn(`[llm] generateText attempt ${attempt} (${modelId}) failed:`, err.message);
      if (attempt < 2) await sleep(2000);
    }
  }
  throw new Error(`LLM text call failed (${modelId}): ${lastErr.message}`);
}

module.exports = { generateJSON, generateText, resolveModel, tryParseTruncatedJSON };
