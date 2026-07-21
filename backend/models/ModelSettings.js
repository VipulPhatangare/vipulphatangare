const mongoose = require('mongoose');
const { DEFAULT_MODEL } = require('../config/aiModels');

// Singleton holding the project-wide default model. Any feature whose modelName
// is 'inherit' (or empty) falls back to this. Read through getGlobalModel(),
// which caches the value briefly so we don't hit Mongo on every single AI call.
const modelSettingsSchema = new mongoose.Schema({
  globalModel: { type: String, default: DEFAULT_MODEL }
}, { timestamps: true });

const ModelSettings = mongoose.model('ModelSettings', modelSettingsSchema);

let cache = { value: null, at: 0 };
const TTL_MS = 15 * 1000;

// Lazily creates the singleton and returns the current global model id, cached
// for TTL_MS. Call invalidateCache() after a write so the change takes effect at once.
async function getGlobalModel() {
  const now = Date.now();
  if (cache.value && now - cache.at < TTL_MS) return cache.value;
  let doc = await ModelSettings.findOne();
  if (!doc) doc = await ModelSettings.create({});
  cache = { value: doc.globalModel || DEFAULT_MODEL, at: now };
  return cache.value;
}

function invalidateCache() {
  cache = { value: null, at: 0 };
}

ModelSettings.getGlobalModel = getGlobalModel;
ModelSettings.invalidateCache = invalidateCache;
module.exports = ModelSettings;
