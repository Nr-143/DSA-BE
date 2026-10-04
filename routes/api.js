const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const sanitizeHtml = require('sanitize-html');

const Topic = require('../models/Topic');
const Progress = require('../models/Progress');
const Note = require('../models/Note');

// Helper to read local JSON fallback if MongoDB is empty/unreachable
function getFallbackTopics() {
  const filePath = path.resolve(__dirname, '..', 'data', 'topics.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw).topics.sort((a, b) => a.order - b.order);
}

// In-memory fallback notes cache in case MongoDB is unreachable
const memoryNotesCache = {};

// Sanitizer Configuration (Task 1 Spec)
const SANITIZE_OPTIONS = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol',
    'nl', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div',
    'span', 'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre',
    'img', 'figure', 'figcaption'
  ],
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    '*': ['class', 'style']
  },
  selfClosing: ['img', 'br', 'hr'],
  allowedSchemes: ['http', 'https', 'data']
};

/**
 * GET /api/topics
 */
router.get('/topics', async (req, res) => {
  try {
    let topics = await Topic.find({}).sort({ order: 1 });
    if (!topics || topics.length === 0) {
      topics = getFallbackTopics();
    }
    res.json({ success: true, data: topics });
  } catch (err) {
    console.warn('⚠️ MongoDB query failed, using fallback JSON topics:', err.message);
    res.json({ success: true, data: getFallbackTopics() });
  }
});

/**
 * GET /api/progress
 */
router.get('/progress', async (req, res) => {
  try {
    const records = await Progress.find({});
    const completedIds = records.filter(r => r.completed).map(r => r.topicId);
    
    let totalCount = await Topic.countDocuments({});
    if (totalCount === 0) {
      totalCount = getFallbackTopics().length;
    }

    res.json({
      success: true,
      data: {
        completedTopicIds: completedIds,
        total: totalCount,
        completed: completedIds.length
      }
    });
  } catch (err) {
    const fallbackTopics = getFallbackTopics();
    const completedIds = fallbackTopics.filter(t => t.completed).map(t => t.id);

    res.json({
      success: true,
      data: {
        completedTopicIds: completedIds,
        total: fallbackTopics.length,
        completed: completedIds.length
      }
    });
  }
});

/**
 * PATCH /api/progress/:topicId
 */
router.patch('/progress/:topicId', async (req, res) => {
  const { topicId } = req.params;
  const { completed } = req.body;

  if (typeof completed !== 'boolean') {
    return res.status(400).json({
      success: false,
      error: '"completed" must be a boolean (true or false).'
    });
  }

  try {
    const updated = await Progress.findOneAndUpdate(
      { topicId },
      { completed },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: `Topic "${topicId}" progress updated to ${completed}`,
      data: { topicId: updated.topicId, completed: updated.completed }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Failed to update progress in MongoDB: ${err.message}`
    });
  }
});

/**
 * GET /api/notes/:topicId
 * Fetch DB-stored handwritten notes HTML for a topic
 */
router.get('/notes/:topicId', async (req, res) => {
  const { topicId } = req.params;

  try {
    const note = await Note.findOne({ topicId });

    if (!note) {
      // Check memory fallback
      if (memoryNotesCache[topicId]) {
        return res.json({
          success: true,
          data: { topicId, html: memoryNotesCache[topicId].html, updatedAt: memoryNotesCache[topicId].updatedAt }
        });
      }
      return res.json({
        success: true,
        data: { topicId, html: null }
      });
    }

    res.json({
      success: true,
      data: {
        topicId: note.topicId,
        html: note.html,
        updatedAt: note.updatedAt
      }
    });
  } catch (err) {
    console.warn(`⚠️ Notes DB lookup failed for ${topicId}, checking fallback cache:`, err.message);
    if (memoryNotesCache[topicId]) {
      return res.json({
        success: true,
        data: { topicId, html: memoryNotesCache[topicId].html, updatedAt: memoryNotesCache[topicId].updatedAt }
      });
    }
    res.json({
      success: true,
      data: { topicId, html: null }
    });
  }
});

/**
 * PUT /api/notes/:topicId
 * Sanitize and upsert DB-stored handwritten notes HTML for a topic
 */
router.put('/notes/:topicId', async (req, res) => {
  const { topicId } = req.params;
  const { html } = req.body;

  if (typeof html !== 'string') {
    return res.status(400).json({
      success: false,
      error: '"html" must be a string containing handwritten notes HTML.'
    });
  }

  // Server-side HTML Sanitization
  const sanitizedHtml = sanitizeHtml(html, SANITIZE_OPTIONS);

  // Store in memory cache fallback
  memoryNotesCache[topicId] = {
    html: sanitizedHtml,
    updatedAt: new Date()
  };

  try {
    const updatedNote = await Note.findOneAndUpdate(
      { topicId },
      { html: sanitizedHtml },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: `Handwritten notes for "${topicId}" saved and sanitized successfully.`,
      data: {
        topicId: updatedNote.topicId,
        html: updatedNote.html,
        updatedAt: updatedNote.updatedAt
      }
    });
  } catch (err) {
    console.error(`❌ Failed to save notes to DB:`, err.message);
    // Respond with sanitized memory fallback
    res.json({
      success: true,
      message: `Handwritten notes for "${topicId}" saved to memory cache fallback.`,
      data: {
        topicId,
        html: sanitizedHtml,
        updatedAt: memoryNotesCache[topicId].updatedAt
      }
    });
  }
});

module.exports = router;
