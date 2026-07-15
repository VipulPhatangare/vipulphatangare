// Feeds the agent knowledge base (ChatbotChunk store, the same one the LinkedIn
// agent and portfolio chatbot retrieve from) with two sources it was previously
// blind to:
//   1. The applicant's saved LinkedIn posts — so the agent learns their voice and
//      can avoid repeating past content.
//   2. The profile bio / "about me" — so generated content is grounded in it.
//
// Everything here is delete-then-reinsert per source so re-syncing never leaves
// duplicate chunks behind. Chunks are tagged source:'linkedin'|'profile' and get
// a stable sourceLabel that also encodes the origin id for idempotent updates.

const ChatbotChunk = require('../models/ChatbotChunk');
const Profile = require('../models/Profile');
const LinkedInPost = require('../models/LinkedInPost');
const { chunkText } = require('./chunker');
const { embedBatch } = require('./embedder');

const postLabel = post => `LinkedIn post ${post._id}`;

// The best available text for a saved post: the edited final post, else the
// favourite/first stored variant body.
function postText(post) {
  if (post.finalPost && post.finalPost.trim()) return post.finalPost.trim();
  const v = (post.variants || []).find(x => x.content && x.content.trim());
  return v ? v.content.trim() : '';
}

// (Re)index a single saved post. Removes any prior chunks for the same post first
// so an edited/re-saved post replaces its old embedding instead of stacking.
async function indexLinkedInPost(post) {
  const label = postLabel(post);
  await ChatbotChunk.deleteMany({ source: 'linkedin', sourceLabel: label });

  const body = postText(post);
  if (!body) return 0;

  // Prefix the prompt/topic so retrieval on a related topic surfaces the past post.
  const header = post.userPrompt ? `Topic: ${post.userPrompt}\n\n` : '';
  const chunks = chunkText(header + body);
  if (!chunks.length) return 0;

  const embeddings = await embedBatch(chunks);
  await ChatbotChunk.insertMany(chunks.map((text, i) => ({
    text, source: 'linkedin', sourceLabel: label, embedding: embeddings[i], chunkIndex: i
  })));
  return chunks.length;
}

// (Re)index the profile bio. Clears all profile-sourced chunks first; if the bio
// is empty it simply leaves the store clean and returns 0.
async function indexProfileBio(profile) {
  await ChatbotChunk.deleteMany({ source: 'profile' });
  const bio = (profile?.bio || '').trim();
  if (!bio) return 0;

  const header = [profile.name, profile.title, profile.tagline].filter(Boolean).join(' — ');
  const chunks = chunkText((header ? header + '\n\n' : '') + bio);
  if (!chunks.length) return 0;

  const embeddings = await embedBatch(chunks);
  await ChatbotChunk.insertMany(chunks.map((text, i) => ({
    text, source: 'profile', sourceLabel: 'Profile bio', embedding: embeddings[i], chunkIndex: i
  })));
  return chunks.length;
}

// Full retroactive sync: bio + every saved post. Used by the "Sync knowledge base"
// button so posts saved before auto-indexing existed still get picked up.
async function syncLinkedInKnowledge() {
  const [profile, posts] = await Promise.all([
    Profile.findOne().lean(),
    LinkedInPost.find().lean()
  ]);

  const bioChunks = await indexProfileBio(profile);

  let postChunks = 0;
  let indexedPosts = 0;
  for (const post of posts) {
    const n = await indexLinkedInPost(post);
    postChunks += n;
    if (n) indexedPosts++;
  }

  return {
    posts: indexedPosts,
    totalPosts: posts.length,
    bioIndexed: bioChunks > 0,
    chunks: bioChunks + postChunks
  };
}

module.exports = { indexLinkedInPost, indexProfileBio, syncLinkedInKnowledge };
