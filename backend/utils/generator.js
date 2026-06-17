const { GoogleGenerativeAI } = require('@google/generative-ai');

async function generateResponse(userMessage, chunks, config) {
  const { systemPrompt, modelName, maxTokens } = config;

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.1
    }
  });

  let prompt;
  if (chunks.length > 0) {
    const contextText = chunks
      .map((c, i) => `[Source ${i + 1} | ${c.sourceLabel || 'Knowledge Base'}]:\n${c.text}`)
      .join('\n\n---\n\n');
    prompt = `CONTEXT:\n${contextText}\n\nQUESTION: ${userMessage}`;
  } else {
    prompt = `QUESTION: ${userMessage}\n\n(No relevant context found in the knowledge base.)`;
  }

  const result = await model.generateContent(prompt);
  const answer = result.response.text();

  return {
    answer,
    hasContext: chunks.length > 0,
    sources: chunks.map(c => ({
      preview: c.text.slice(0, 120).trim() + (c.text.length > 120 ? '…' : ''),
      sourceLabel: c.sourceLabel || 'Knowledge Base',
      score: Math.round((c.score || 0) * 1000) / 1000
    })),
    model: modelName
  };
}

module.exports = { generateResponse };
