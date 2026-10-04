/**
 * DSA Tracker — Express Backend API (MongoDB)
 * ───────────────────────────────────────────
 * Standalone backend repository connected to MongoDB.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3001;

/* ────────── Middleware ────────── */
app.use(cors());
app.use(express.json());

/* ────────── Connect MongoDB ────────── */
connectDB();

/* ────────── API Routes ────────── */
app.use('/api', apiRoutes);

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
  console.log(`\n🚀 DSA Tracker Backend API running on http://localhost:${PORT}`);
  console.log(`   GET   /api/topics`);
  console.log(`   GET   /api/progress`);
  console.log(`   PATCH /api/progress/:topicId`);
  console.log(`   GET   /api/health\n`);
});
