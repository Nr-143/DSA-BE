const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dsa_tracker_default_jwt_secret_key_2026';
const ACCESS_TOKEN_EXPIRES_IN = '15m'; // ~15 minutes

/**
 * Sign an Access Token containing only userId and exp
 */
function signAccessToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
}

/**
 * Verify an Access Token. Returns payload { userId, exp, iat } if valid, null if invalid/expired.
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  ACCESS_TOKEN_EXPIRES_IN
};
