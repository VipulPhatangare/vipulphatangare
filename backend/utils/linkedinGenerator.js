const { GoogleGenerativeAI } = require('@google/generative-ai');

const LENGTH_INSTRUCTIONS = {
  short:  '100–150 words',
  medium: '180–250 words',
  long:   '300–500 words'
};

const TONE_INSTRUCTIONS = {
  professional: 'Professional and authoritative — confident, credible, polished.',
  storytelling: 'Storytelling narrative — personal journey, relatable, emotional hooks.',
  insights:     'Thought-leadership insights — lessons learned, analytical, industry perspective.',
  casual:       'Casual and conversational — approachable, friendly, everyday language.'
};

function parseHashtag(h) {
  if (typeof h === 'string') return h.replace(/^#/, '').trim();
  if (h && typeof h === 'object') {
    const val = h.tag || h.name || h.hashtag || h.value || h.text || h.word || h.label;
    if (typeof val === 'string') return val.replace(/^#/, '').trim();
    const first = Object.values(h).find(v => typeof v === 'string');
    if (first) return first.replace(/^#/, '').trim();
  }
  return '';
}

function buildContext(chunks) {
  if (!chunks.length) return '';
  return 'PORTFOLIO CONTEXT:\n' +
    chunks.map((c, i) => `[Source ${i + 1} | ${c.sourceLabel || 'Portfolio'}]:\n${c.text}`)
          .join('\n\n---\n\n') +
    '\n\n';
}

function buildUrlContext(urlMeta) {
  if (!urlMeta?.url) return '';
  let s = `PROJECT LINK: ${urlMeta.url}\n`;
  if (urlMeta.title)       s += `Page Title: ${urlMeta.title}\n`;
  if (urlMeta.description) s += `Page Description: ${urlMeta.description}\n`;
  return s + '\n';
}

async function generateComponents(userPrompt, chunks, config, tone = 'professional', length = 'medium', urlMeta = null) {
  const { systemPrompt, modelName, maxTokens } = config;

  console.log('\n========== LINKEDIN GENERATOR v2 ==========');
  console.log('Model:', modelName, '| Tone:', tone, '| Length:', length, '| Chunks:', chunks.length, '| URL:', urlMeta?.url || 'none');

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.8 }
  });

  const contextPart = buildContext(chunks) + buildUrlContext(urlMeta);
  const prompt = `${contextPart}USER REQUEST: ${userPrompt}

Tone: ${TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.professional}
Body length: ${LENGTH_INSTRUCTIONS[length] || LENGTH_INSTRUCTIONS.medium} each

Generate LinkedIn content components as a JSON object with EXACTLY this structure:
{
  "titles": [array of exactly 10 unique hook headlines / opening lines],
  "bodies": [array of exactly 3 unique full post bodies — NO hashtags inside bodies],
  "hashtags": [array of 10 to 14 relevant hashtag words, no # prefix]
}

Output ONLY the raw JSON object. No markdown fences, no explanation.`;

  const result = await model.generateContent(prompt);
  let raw = result.response.text().trim();
  console.log('Raw (first 300):', raw.slice(0, 300));
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  const parsed = JSON.parse(raw);
  const components = {
    titles:   (parsed.titles   || []).map(t => String(t).trim()).filter(Boolean).slice(0, 10),
    bodies:   (parsed.bodies   || []).map(b => String(b).trim()).filter(Boolean).slice(0, 3),
    hashtags: (parsed.hashtags || []).map(h => parseHashtag(h)).filter(Boolean)
  };

  console.log(`titles:${components.titles.length} bodies:${components.bodies.length} hashtags:${components.hashtags.length}`);
  console.log('===========================================\n');
  return components;
}

async function regenerateSection(userPrompt, chunks, config, tone, length, section, bodyIndex, projectUrl = '') {
  const { systemPrompt, modelName, maxTokens } = config;

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.88 }
  });

  const urlLine = projectUrl ? `PROJECT LINK: ${projectUrl}\n\n` : '';
  const contextPart = buildContext(chunks) + urlLine;
  const toneStr   = TONE_INSTRUCTIONS[tone]   || TONE_INSTRUCTIONS.professional;
  const lengthStr = LENGTH_INSTRUCTIONS[length] || LENGTH_INSTRUCTIONS.medium;

  if (section === 'titles') {
    const prompt = `${contextPart}USER REQUEST: ${userPrompt}\nTone: ${toneStr}\n\nGenerate 10 fresh, diverse LinkedIn hook headlines (different from any previously generated). Return ONLY a JSON array of 10 strings.`;
    const result = await model.generateContent(prompt);
    let raw = result.response.text().trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(raw);
    return { titles: (Array.isArray(parsed) ? parsed : parsed.titles || []).map(t => String(t).trim()) };
  }

  if (section === 'bodies') {
    const prompt = `${contextPart}USER REQUEST: ${userPrompt}\nTone: ${toneStr}\nLength: ${lengthStr} each\n\nGenerate 3 fresh LinkedIn post bodies with different angles (no hashtags inside). Return ONLY a JSON array of 3 strings.`;
    const result = await model.generateContent(prompt);
    let raw = result.response.text().trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(raw);
    return { bodies: (Array.isArray(parsed) ? parsed : parsed.bodies || []).map(b => String(b).trim()) };
  }

  if (section === 'body' && bodyIndex !== undefined) {
    const prompt = `${contextPart}USER REQUEST: ${userPrompt}\nTone: ${toneStr}\nLength: ${lengthStr}\n\nGenerate 1 fresh LinkedIn post body with a different angle than before (no hashtags inside). Return ONLY a JSON object: {"body": "..."}`;
    const result = await model.generateContent(prompt);
    let raw = result.response.text().trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(raw);
    return { body: String(parsed.body || parsed).trim(), index: bodyIndex };
  }

  if (section === 'hashtags') {
    const prompt = `${contextPart}USER REQUEST: ${userPrompt}\n\nGenerate 10–14 fresh, highly relevant LinkedIn hashtag words (no # prefix, no duplicates). Return ONLY a JSON array of strings.`;
    const result = await model.generateContent(prompt);
    let raw = result.response.text().trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(raw);
    return { hashtags: (Array.isArray(parsed) ? parsed : parsed.hashtags || []).map(h => parseHashtag(h)).filter(Boolean) };
  }

  throw new Error('Invalid section: ' + section);
}

module.exports = { generateComponents, regenerateSection };
