// Central registry of every AI model the app can use. Each feature stores a
// `modelName` that is either one of these ids or the sentinel 'inherit' (meaning
// "use the global default"). The unified LLM helper (utils/llm.js) routes a call
// to the right provider based on the model's `provider` field.

const INHERIT = 'inherit';
const DEFAULT_MODEL = 'gemini-2.5-flash';

const MODELS = [
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    provider: 'gemini'
  },
  {
    id: 'deepseek-v4-flash',
    label: 'DeepSeek V4 Flash',
    provider: 'nvidia',
    nvidiaModel: 'deepseek-ai/deepseek-v4-flash',
    // DeepSeek "flash" reasons before answering — slower but stronger. thinking
    // tokens are stripped by the helper, only the final content is returned.
    thinking: true,
    reasoningEffort: 'high'
  },
  {
    id: 'deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    provider: 'nvidia',
    nvidiaModel: 'deepseek-ai/deepseek-v4-pro',
    thinking: false
  },
  {
    id: 'kimi-k2.6',
    label: 'Kimi K2.6',
    provider: 'nvidia',
    nvidiaModel: 'moonshotai/kimi-k2.6'
  }
];

const BY_ID = new Map(MODELS.map(m => [m.id, m]));

// Returns the registry entry for an id, falling back to the default model when
// the id is unknown (e.g. a stale value saved in the DB before a model was renamed).
function getModel(id) {
  return BY_ID.get(id) || BY_ID.get(DEFAULT_MODEL);
}

// Public-safe list for the frontend dropdowns (no secrets, just id + label + provider).
function listModels() {
  return MODELS.map(({ id, label, provider }) => ({ id, label, provider }));
}

module.exports = { MODELS, getModel, listModels, DEFAULT_MODEL, INHERIT };
