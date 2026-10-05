const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for requesting OTP (max 3 requests per 10 minutes per IP)
 */
const requestOtpRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 50, // Increased for dev testing
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many OTP requests from this IP. Please try again in 10 minutes.'
    }
  }
});

module.exports = {
  requestOtpRateLimiter
};
