const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
// Derive a stable 32-byte key from the secret
const KEY = crypto.scryptSync(
  process.env.ENCRYPTION_SECRET || process.env.JWT_SECRET || 'fallback_secret_key',
  'vipul_portfolio_salt_v1',
  32
);

function encrypt(plainText) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(stored) {
  const [ivHex, authTagHex, encrypted] = stored.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = { encrypt, decrypt };
