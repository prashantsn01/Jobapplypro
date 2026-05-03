// server/services/cryptoService.js
// AES-256-GCM encryption for storing OAuth tokens in the database.
// Key must be 64 hex chars (32 bytes) set in ENCRYPTION_KEY env var.
const crypto = require('crypto');

const ALGO       = 'aes-256-gcm';
const IV_BYTES   = 12;   // 96-bit IV recommended for GCM
const TAG_BYTES  = 16;

function getKey() {
  const hex = process.env.ENCRYPTION_KEY || '';
  if (hex.length !== 64) throw new Error('ENCRYPTION_KEY must be 64 hex characters');
  return Buffer.from(hex, 'hex');
}

function encrypt(plaintext) {
  if (!plaintext) return null;
  const iv         = crypto.randomBytes(IV_BYTES);
  const cipher     = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted  = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag        = cipher.getAuthTag();
  // Format: iv:tag:ciphertext  (all base64)
  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

function decrypt(stored) {
  if (!stored) return null;
  try {
    const parts = stored.split(':');
    if (parts.length !== 3) return null;
    const [ivB64, tagB64, dataB64] = parts;
    const iv        = Buffer.from(ivB64,  'base64');
    const tag       = Buffer.from(tagB64, 'base64');
    const data      = Buffer.from(dataB64,'base64');
    const decipher  = crypto.createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    return decipher.update(data) + decipher.final('utf8');
  } catch {
    return null;
  }
}

module.exports = { encrypt, decrypt };
