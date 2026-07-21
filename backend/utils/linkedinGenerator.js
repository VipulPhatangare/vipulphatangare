const { generateJSON, resolveModel } = require('./llm');

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
  const resolvedModel = await resolveModel(modelName);

  console.log('\n========== LINKEDIN GENERATOR v2 ==========');
  console.log('Model:', resolvedModel, '| Tone:', tone, '| Length:', length, '| Chunks:', chunks.length, '| URL:', urlMeta?.url || 'none');

  const contextPart = buildContext(chunks) + buildUrlContext(urlMeta);
  const prompt = `${contextPart}USER REQUEST: ${userPrompt}

Tone: ${TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.professional}
Body length: ${LENGTH_INSTRUCTIONS[length] || LENGTH_INSTRUCTIONS.medium} each

Generate LinkedIn content components as a JSON object with EXACTLY this structure:
{
  "titles": [array of exactly 10 unique hook headlines / opening lines],
  "bodies": [array of exactly 3 unique full post bodies — NO hashtags inside bodies],
  "hashtags": [array of 20 to 25 hashtag words, no # prefix — mix of post-specific niche hashtags AND broad high-reach viral LinkedIn hashtags (e.g. innovation, technology, ai, careers)]
}

Output ONLY the raw JSON object. No markdown fences, no explanation.`;

  const parsed = await generateJSON({ modelId: resolvedModel, system: systemPrompt, prompt, temperature: 0.8, maxTokens });
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
  const resolvedModel = await resolveModel(modelName);
  const callJSON = (prompt, temperature = 0.88) =>
    generateJSON({ modelId: resolvedModel, system: systemPrompt, prompt, temperature, maxTokens });

  const urlLine = projectUrl ? `PROJECT LINK: ${projectUrl}\n\n` : '';
  const contextPart = buildContext(chunks) + urlLine;
  const toneStr   = TONE_INSTRUCTIONS[tone]   || TONE_INSTRUCTIONS.professional;
  const lengthStr = LENGTH_INSTRUCTIONS[length] || LENGTH_INSTRUCTIONS.medium;

  if (section === 'titles') {
    const prompt = `${contextPart}USER REQUEST: ${userPrompt}\nTone: ${toneStr}\n\nGenerate 10 fresh, diverse LinkedIn hook headlines (different from any previously generated). Return ONLY a JSON object: {"titles": [10 strings]}.`;
    const parsed = await callJSON(prompt);
    return { titles: (Array.isArray(parsed) ? parsed : parsed.titles || []).map(t => String(t).trim()) };
  }

  if (section === 'bodies') {
    const prompt = `${contextPart}USER REQUEST: ${userPrompt}\nTone: ${toneStr}\nLength: ${lengthStr} each\n\nGenerate 3 fresh LinkedIn post bodies with different angles (no hashtags inside). Return ONLY a JSON object: {"bodies": [3 strings]}.`;
    const parsed = await callJSON(prompt);
    return { bodies: (Array.isArray(parsed) ? parsed : parsed.bodies || []).map(b => String(b).trim()) };
  }

  if (section === 'body' && bodyIndex !== undefined) {
    const prompt = `${contextPart}USER REQUEST: ${userPrompt}\nTone: ${toneStr}\nLength: ${lengthStr}\n\nGenerate 1 fresh LinkedIn post body with a different angle than before (no hashtags inside). Return ONLY a JSON object: {"body": "..."}`;
    const parsed = await callJSON(prompt);
    return { body: String(parsed.body || parsed).trim(), index: bodyIndex };
  }

  if (section === 'hashtags') {
    const prompt = `${contextPart}USER REQUEST: ${userPrompt}\n\nGenerate EXACTLY 20 to 25 fresh LinkedIn hashtag words (no # prefix, no duplicates). This count of 20–25 is mandatory and overrides any other instruction about hashtag count.\nInclude a mix of:\n- 12–15 highly specific hashtags tied to this post's topic, technologies, and domain\n- 8–10 broad, high-reach viral LinkedIn hashtags that boost visibility (e.g. innovation, technology, ai, careers, programming, softwaredevelopment, learning, growth)\nReturn ONLY a JSON object: {"hashtags": [20-25 strings]}.`;
    const parsed = await callJSON(prompt);
    return { hashtags: (Array.isArray(parsed) ? parsed : parsed.hashtags || []).map(h => parseHashtag(h)).filter(Boolean).slice(0, 25) };
  }

  throw new Error('Invalid section: ' + section);
}

module.exports = { generateComponents, regenerateSection };
