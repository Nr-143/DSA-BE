/**
 * OneStep Journey — Express Backend API
 * ───────────────────────────────────────
 * Multi-user Email+OTP Authentication & Per-User Progress Sync
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { initDB } = require('./config/db');

const authRoutes = require('./routes/auth');
const progressRoutes = require('./routes/progress');
const leetcodeRoutes = require('./routes/leetcode');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3001;

/* ────────── CORS & Middleware ────────── */
app.use(cors({
  origin: function (origin, callback) {
    // Allow local dev origins
    if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      return callback(null, true);
    }
    callback(null, true);
  },
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

/* ────────── Initialize Database ────────── */
initDB().catch(err => {
  console.error('❌ Failed to initialize DB:', err);
});

/* ────────── API Routes ────────── */
app.use('/api/auth', authRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/leetcode', leetcodeRoutes);
app.use('/api', apiRoutes);

/* ────────── Public Config Endpoint ────────── */
app.get('/api/config', (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    apiBaseUrl: `http://localhost:${PORT}/api`
  });
});

/* ────────── Health Check ────────── */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

/* ────────── 404 Handler ────────── */
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found.' });
});

/* ────────── Start Server ────────── */
app.listen(PORT, () => {
  console.log(`\n🚀 OneStep Journey Backend running on http://localhost:${PORT}`);
  console.log(`   POST  /api/auth/google`);
  console.log(`   POST  /api/auth/refresh`);
  console.log(`   POST  /api/auth/logout`);
  console.log(`   GET   /api/progress`);
  console.log(`   PATCH /api/progress/:topicId`);
  console.log(`   GET   /api/health\n`);
});
