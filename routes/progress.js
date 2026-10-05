const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { query, execute } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const Progress = require('../models/Progress');

// Load topics list for validation
let validTopicIds = new Set();
try {
  const topicsFilePath = path.resolve(__dirname, '..', 'data', 'topics.json');
  if (fs.existsSync(topicsFilePath)) {
    const raw = fs.readFileSync(topicsFilePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.topics && Array.isArray(parsed.topics)) {
      validTopicIds = new Set(parsed.topics.map(t => t.id));
    }
  }
} catch (err) {
  console.warn('⚠️ Could not load topics.json for topicId validation:', err.message);
}

/**
 * GET /api/progress
 * Protected route. Identity derived strictly from token.
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const rows = await query(`SELECT topic_id FROM user_progress WHERE user_id = ?`, [userId]);
    const completedTopicIds = rows.map(r => r.topic_id);

    res.json({
      success: true,
      completedTopicIds
    });
  } catch (err) {
    console.error('❌ GET /api/progress error:', err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch progress' } });
  }
});

/**
 * PATCH /api/progress/:topicId
 * Protected route. Identity derived strictly from token.
 * Updates user_progress and progress collections in MongoDB scoped strictly to userId.
 */
router.patch('/:topicId', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { topicId } = req.params;
    const { completed } = req.body;

    if (typeof completed !== 'boolean') {
      return res.status(400).json({
        error: { code: 'INVALID_INPUT', message: '"completed" must be a boolean.' }
      });
    }

    // Validate topicId against real topics list if set loaded
    if (validTopicIds.size > 0 && !validTopicIds.has(topicId)) {
      return res.status(400).json({
        error: { code: 'INVALID_TOPIC_ID', message: `Topic ID "${topicId}" is not valid.` }
      });
    }

    const nowIso = new Date().toISOString();

    if (completed) {
      await execute(`DELETE FROM user_progress WHERE user_id = ? AND topic_id = ?`, [userId, topicId]);
      await execute(
        `INSERT INTO user_progress (user_id, topic_id, completed_at) VALUES (?, ?, ?)`,
        [userId, topicId, nowIso]
      );
    } else {
      await execute(`DELETE FROM user_progress WHERE user_id = ? AND topic_id = ?`, [userId, topicId]);
    }

    // Sync user progress in Progress collection (strictly per userId)
    try {
      await Progress.updateOne(
        { userId, topicId },
        { $set: { userId, topicId, completed, completedAt: completed ? new Date() : null } },
        { upsert: true }
      );
    } catch (dbErr) {
      console.warn('⚠️ Mongoose Progress update warning:', dbErr.message);
    }

    console.log(`✅ [PROGRESS UPDATED] User: ${userId} | Topic: ${topicId} | Completed: ${completed}`);

    res.json({
      success: true,
      topicId,
      completed
    });
  } catch (err) {
    console.error('❌ PATCH /api/progress/:topicId error:', err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to update progress' } });
  }
});

module.exports = router;
