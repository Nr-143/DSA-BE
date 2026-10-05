const { verifyAccessToken } = require('../utils/jwt');

/**
 * Strict authentication middleware for protected routes
 * Standard error response on missing, malformed, or expired token:
 * HTTP 401
 * { "error": { "code": "AUTH_TOKEN_REQUIRED", "message": "Login required" } }
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'AUTH_TOKEN_REQUIRED',
        message: 'Login required'
      }
    });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({
      error: {
        code: 'AUTH_TOKEN_REQUIRED',
        message: 'Login required'
      }
    });
  }

  const payload = verifyAccessToken(token);
  if (!payload || !payload.userId) {
    return res.status(401).json({
      error: {
        code: 'AUTH_TOKEN_REQUIRED',
        message: 'Login required'
      }
    });
  }

  // Derive identity strictly from verified token claim
  req.user = { id: payload.userId };
  next();
}

module.exports = { requireAuth };
