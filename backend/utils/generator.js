const { generateText, resolveModel } = require('./llm');

// history: array of { role: 'user'|'model', parts: [{ text }] }, oldest first
async function generateResponse(userMessage, chunks, projects = [], config, history = []) {
  const { systemPrompt, modelName, maxTokens } = config;

  const resolvedModel = await resolveModel(modelName);

  // Build context block
  const contextParts = [];

  if (chunks.length > 0) {
    const chunkText = chunks
      .map((c, i) => `[${c.sourceLabel || 'Knowledge Base'}]:\n${c.text}`)
      .join('\n\n---\n\n');
    contextParts.push(`KNOWLEDGE BASE:\n${chunkText}`);
  }

  if (projects.length > 0) {
    const projectText = projects.map(p =>
      `Project: ${p.title}\nCategory: ${p.category}\nDescription: ${p.description}\nTech Stack: ${(p.techStack || []).join(', ')}\nDemo Link: ${p.demoLink || ''}\nCode Link: ${p.codeLink || ''}\nDrive Link: ${p.driveLink || ''}`
    ).join('\n\n');
    contextParts.push(`PROJECT DATA (always include these exact links in your response):\n${projectText}`);
  }

  const contextBlock = contextParts.length > 0
    ? contextParts.join('\n\n===\n\n')
    : '(No direct context found — use conversation history if available)';

  const prompt = `CONTEXT:\n${contextBlock}\n\nQUESTION: ${userMessage}`;
  const raw = await generateText({
    modelId: resolvedModel,
    system: systemPrompt,
    prompt,
    history,
    temperature: 0.2,
    maxTokens,
    json: true
  });

  let structured;
  try {
    structured = JSON.parse(raw);
    if (!structured.template) throw new Error('missing template field');
  } catch {
    structured = { template: 'text', content: raw };
  }

  return {
    ...structured,
    hasContext: chunks.length > 0 || projects.length > 0,
    sources: chunks.map(c => ({
      preview: c.text.slice(0, 120).trim() + (c.text.length > 120 ? '…' : ''),
      sourceLabel: c.sourceLabel || 'Knowledge Base',
      score: Math.round((c.score || 0) * 1000) / 1000
    })),
    model: resolvedModel,
    rawText: raw
  };
}

module.exports = { generateResponse };
