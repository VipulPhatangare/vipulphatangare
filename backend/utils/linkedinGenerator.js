const { GoogleGenerativeAI } = require('@google/generative-ai');

async function generateLinkedInPosts(userPrompt, chunks, config) {
  const { systemPrompt, modelName, maxTokens } = config;

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.75
    }
  });

  let prompt;
  if (chunks.length > 0) {
    const contextText = chunks
      .map((c, i) => `[Source ${i + 1} | ${c.sourceLabel || 'Portfolio'}]:\n${c.text}`)
      .join('\n\n---\n\n');
    prompt = `PORTFOLIO CONTEXT:\n${contextText}\n\nUSER REQUEST: ${userPrompt}\n\nGenerate 3 LinkedIn post variants as a JSON array.`;
  } else {
    prompt = `USER REQUEST: ${userPrompt}\n\n(No portfolio context found — generate based on the request alone.)\n\nGenerate 3 LinkedIn post variants as a JSON array.`;
  }

  const result = await model.generateContent(prompt);
  let raw = result.response.text().trim();

  // Strip markdown code fences if Gemini wraps the output
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let variants;
  try {
    variants = JSON.parse(raw);
    if (!Array.isArray(variants)) throw new Error('Response is not an array');
    variants = variants.slice(0, 3).map(v => ({
      content: String(v.content || '').trim(),
      hashtags: Array.isArray(v.hashtags)
        ? v.hashtags.map(h => String(h).replace(/^#/, '').trim()).filter(Boolean)
        : []
    }));
  } catch {
    // Graceful fallback: wrap the raw text as a single variant
    variants = [{ content: raw.slice(0, 500), hashtags: [] }];
  }

  return variants;
}

module.exports = { generateLinkedInPosts };
