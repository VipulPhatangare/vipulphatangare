const ChatbotChunk = require('../models/ChatbotChunk');

async function retrieve(queryVector, topK = 5) {
  const results = await ChatbotChunk.aggregate([
    {
      $vectorSearch: {
        index: 'vipul_chatbot',
        path: 'embedding',
        queryVector,
        numCandidates: topK * 15,
        limit: topK
      }
    },
    {
      $project: {
        text: 1,
        sourceLabel: 1,
        source: 1,
        score: { $meta: 'vectorSearchScore' }
      }
    }
  ]);
  return results;
}

module.exports = { retrieve };
