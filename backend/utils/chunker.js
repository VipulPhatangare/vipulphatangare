function chunkText(text, chunkWords = 400, overlapWords = 80) {
  const cleaned = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return [];

  const chunks = [];
  const step = chunkWords - overlapWords;

  for (let i = 0; i < words.length; i += step) {
    const chunk = words.slice(i, i + chunkWords).join(' ').trim();
    if (chunk) chunks.push(chunk);
    if (i + chunkWords >= words.length) break;
  }

  return chunks;
}

module.exports = { chunkText };
