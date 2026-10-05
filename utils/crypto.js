const crypto = require('crypto');

/**
 * SHA-256 string hashing utility
 * Used for hashing OTP codes and Refresh Tokens
 */
function hashString(str) {
  if (!str) return '';
  return crypto.createHash('sha256').update(String(str)).digest('hex');
}

/**
 * Generate a random 6-digit numeric OTP code
 */
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate a random cryptographically secure token string
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a random UUID v4
 */
function generateUUID() {
  return crypto.randomUUID ? crypto.randomUUID() : (require('uuid').v4());
}

module.exports = {
  hashString,
  generateOtp,
  generateToken,
  generateUUID
};
