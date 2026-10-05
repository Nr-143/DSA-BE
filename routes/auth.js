const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const { queryOne, execute } = require('../config/db');
const { hashString, generateToken, generateUUID } = require('../utils/crypto');
const { signAccessToken } = require('../utils/jwt');
const { parseOS } = require('../utils/uaParser');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * POST /api/auth/google
 * Cryptographically verifies Google ID Tokens using Google Public Keys
 * Body: { credential }
 */
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({
        error: { code: 'INVALID_CREDENTIAL', message: 'Google ID token credential is required.' }
      });
    }

    let payload = null;

    // Strict Cryptographic ID Token Verification
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      console.error('❌ Google Token Verification Error:', verifyErr.message);
      return res.status(401).json({
        error: { code: 'INVALID_GOOGLE_TOKEN', message: 'Google authentication failed: Invalid or expired token.' }
      });
    }

    if (!payload || !payload.email) {
      return res.status(401).json({
        error: { code: 'INVALID_TOKEN_PAYLOAD', message: 'Google token does not contain a verified email.' }
      });
    }

    const cleanEmail = payload.email.trim().toLowerCase();
    const userName = payload.name || payload.given_name || 'Learner';
    const userPicture = payload.picture || '';
    const nowIso = new Date().toISOString();

    // Capture Session & Device metadata
    const userAgentStr = req.headers['user-agent'] || '';
    const os = parseOS(userAgentStr);
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

    // Upsert User with Metadata (IP, OS, Desktop/Browser, Name, Picture)
    let user = await queryOne(`SELECT * FROM users WHERE email = ?`, [cleanEmail]);

    if (!user) {
      const userId = generateUUID();
      await execute(
        `INSERT INTO users (id, email, name, picture, ip, os, user_agent, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, cleanEmail, userName, userPicture, String(ip), os, userAgentStr, nowIso, nowIso]
      );
      user = { id: userId, email: cleanEmail, name: userName, picture: userPicture, ip, os, user_agent: userAgentStr };
    } else {
      await execute(
        `UPDATE users SET last_login_at = ?, name = ?, picture = ?, ip = ?, os = ?, user_agent = ? WHERE id = ?`,
        [nowIso, userName, userPicture, String(ip), os, userAgentStr, user.id]
      );
    }
    
    // Create Refresh Token & Session
    const refreshToken = generateToken();
    const refreshTokenHash = hashString(refreshToken);
    const sessionId = generateUUID();
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await execute(
      `INSERT INTO sessions (id, user_id, refresh_token_hash, ip, os, user_agent, created_at, expires_at, revoked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, user.id, refreshTokenHash, String(ip), os, userAgentStr, nowIso, sessionExpiresAt, 0]
    );

    // Issue Access Token
    const accessToken = signAccessToken(user.id);

    // Set Refresh Token Cookie with Security Controls
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    console.log(`🔒 [VERIFIED GOOGLE OAUTH] User: ${cleanEmail} (${userName})`);

    res.json({
      accessToken,
      expiresIn: 900,
      user: {
        id: user.id,
        email: user.email,
        name: userName,
        picture: userPicture
      }
    });
  } catch (err) {
    console.error('❌ Google Auth Error:', err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to authenticate with Google' } });
  }
});

/**
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({
        error: { code: 'AUTH_TOKEN_REQUIRED', message: 'Login required' }
      });
    }

    const tokenHash = hashString(refreshToken);
    const nowIso = new Date().toISOString();
    const session = await queryOne(
      `SELECT * FROM sessions WHERE refresh_token_hash = ? AND revoked = 0 AND expires_at > ?`,
      [tokenHash, nowIso]
    );

    if (!session) {
      res.clearCookie('refreshToken', { path: '/' });
      return res.status(401).json({
        error: { code: 'AUTH_TOKEN_REQUIRED', message: 'Login required' }
      });
    }

    // Revoke old session (Rotation)
    await execute(`UPDATE sessions SET revoked = 1 WHERE id = ?`, [session.id]);

    const user = await queryOne(`SELECT id, email FROM users WHERE id = ?`, [session.user_id]);
    if (!user) {
      res.clearCookie('refreshToken', { path: '/' });
      return res.status(401).json({
        error: { code: 'AUTH_TOKEN_REQUIRED', message: 'Login required' }
      });
    }

    // Issue new Refresh Token & Session
    const newRefreshToken = generateToken();
    const newRefreshTokenHash = hashString(newRefreshToken);
    const newSessionId = generateUUID();
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await execute(
      `INSERT INTO sessions (id, user_id, refresh_token_hash, ip, os, user_agent, created_at, expires_at, revoked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newSessionId, user.id, newRefreshTokenHash, session.ip, session.os, session.user_agent, nowIso, sessionExpiresAt, 0]
    );

    // Issue new Access Token
    const accessToken = signAccessToken(user.id);

    // Set new cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      accessToken,
      expiresIn: 900,
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (err) {
    console.error('❌ Refresh Token Error:', err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to refresh token' } });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      const tokenHash = hashString(refreshToken);
      await execute(`UPDATE sessions SET revoked = 1 WHERE refresh_token_hash = ?`, [tokenHash]);
    }
    res.clearCookie('refreshToken', { path: '/' });
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Logout Error:', err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to log out' } });
  }
});

module.exports = router;
