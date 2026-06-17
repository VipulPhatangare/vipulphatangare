const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function embed(text) {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.trim(),
    encoding_format: 'float'
  });
  return res.data[0].embedding;
}

async function embedBatch(texts) {
  // OpenAI allows up to 2048 inputs; chunk into batches of 100 to be safe
  const BATCH = 100;
  const all = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const res = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch,
      encoding_format: 'float'
    });
    all.push(...res.data.map(d => d.embedding));
  }
  return all;
}

module.exports = { embed, embedBatch };
