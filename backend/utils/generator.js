const { GoogleGenerativeAI } = require('@google/generative-ai');

async function generateResponse(userMessage, chunks, projects = [], config, history = []) {
  const { systemPrompt, modelName, maxTokens } = config;

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.2,
      responseMimeType: 'application/json'
    }
  });

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

  // Format previous turns for Gemini chat history
  const geminiHistory = history
    .filter(h => h.role && h.text)
    .map(h => ({
      role: h.role,
      parts: [{ text: h.text }]
    }));

  const chat = model.startChat({ history: geminiHistory });

  const prompt = `CONTEXT:\n${contextBlock}\n\nQUESTION: ${userMessage}`;
  const result = await chat.sendMessage(prompt);
  const raw = result.response.text().trim();

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
    model: modelName
  };
}

module.exports = { generateResponse };
