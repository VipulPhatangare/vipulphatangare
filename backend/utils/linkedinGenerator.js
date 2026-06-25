const { GoogleGenerativeAI } = require('@google/generative-ai');

async function generateLinkedInPosts(userPrompt, chunks, config) {
  const { systemPrompt, modelName, maxTokens } = config;

  console.log('\n========== LINKEDIN GENERATOR DEBUG ==========');
  console.log('Model    :', modelName);
  console.log('MaxTokens:', maxTokens);
  console.log('Chunks   :', chunks.length);
  console.log('Prompt first 200 chars:', systemPrompt.slice(0, 200));
  console.log('==============================================\n');

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

  console.log('\n========== GEMINI RAW RESPONSE START ==========');
  console.log(raw);
  console.log('========== GEMINI RAW RESPONSE END ============\n');

  // Strip markdown code fences if Gemini wraps the output
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let variants;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Response is not an array');
    variants = parsed.slice(0, 3).map(v => ({
      title:    String(v.title || '').trim(),
      content:  String(v.content || '').trim(),
      hashtags: Array.isArray(v.hashtags)
        ? v.hashtags.map(h => String(h).replace(/^#/, '').trim()).filter(Boolean)
        : []
    }));
    console.log('✅ Parsed variants:');
    variants.forEach((v, i) => {
      console.log(`\n--- Variant ${i + 1} ---`);
      console.log('title   :', v.title);
      console.log('content :', v.content.slice(0, 120), '...');
      console.log('hashtags:', v.hashtags);
    });
  } catch (err) {
    console.error('❌ JSON parse failed:', err.message);
    console.log('Falling back to raw text variant');
    variants = [{ title: '', content: raw.slice(0, 1000), hashtags: [] }];
  }

  return variants;
}

module.exports = { generateLinkedInPosts };
