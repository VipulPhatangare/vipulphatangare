const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { listModels } = require('../config/aiModels');
const ModelSettings = require('../models/ModelSettings');
const ChatbotConfig = require('../models/ChatbotConfig');
const LinkedInAgentConfig = require('../models/LinkedInAgentConfig');
const EmailAgentConfig = require('../models/EmailAgentConfig');
const ResumeAgentConfig = require('../models/ResumeAgentConfig');

// Loads (creating if needed) the singleton config doc for each feature. These are
// the source of truth for per-feature model selection; a 'inherit' value means
// "use the global default".
async function loadAll() {
  const [settings, chatbot, linkedin, email, resume] = await Promise.all([
    ModelSettings.findOne().then(d => d || ModelSettings.create({})),
    ChatbotConfig.findOne().then(d => d || ChatbotConfig.create({})),
    LinkedInAgentConfig.findOne().then(d => d || LinkedInAgentConfig.create({})),
    EmailAgentConfig.findOne().then(d => d || EmailAgentConfig.create({})),
    ResumeAgentConfig.getConfig()
  ]);
  return { settings, chatbot, linkedin, email, resume };
}

function snapshot({ settings, chatbot, linkedin, email, resume }) {
  return {
    models: listModels(),
    globalModel: settings.globalModel,
    features: {
      chatbot:  chatbot.modelName  || 'inherit',
      linkedin: linkedin.modelName || 'inherit',
      email:    email.modelName    || 'inherit',
      resume:   resume.modelName   || 'inherit'
    }
  };
}

// GET /api/models — registry + global default + each feature's current selection
router.get('/', auth, async (req, res) => {
  try {
    res.json(snapshot(await loadAll()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/models — body may include globalModel and/or chatbot|linkedin|email|resume.
// This single endpoint powers both the Model Management tab and every per-feature dropdown.
router.put('/', auth, async (req, res) => {
  try {
    const docs = await loadAll();
    const { globalModel } = req.body;
    const features = req.body.features || req.body; // accept flat or nested shape

    if (typeof globalModel === 'string' && globalModel.trim()) {
      docs.settings.globalModel = globalModel.trim();
      await docs.settings.save();
      ModelSettings.invalidateCache();
    }

    const map = {
      chatbot:  docs.chatbot,
      linkedin: docs.linkedin,
      email:    docs.email,
      resume:   docs.resume
    };
    await Promise.all(Object.entries(map).map(async ([key, doc]) => {
      const val = features[key];
      if (typeof val === 'string' && val.trim()) {
        doc.modelName = val.trim();
        await doc.save();
      }
    }));

    res.json(snapshot(await loadAll()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
