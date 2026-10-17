const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const LeetCodeProblem = require('../models/LeetCodeProblem');
const UserLeetCodeSolved = require('../models/UserLeetCodeSolved');
const { requireAuth } = require('../middleware/auth');

// Helper to get fallback problems from JSON
function getFallbackProblems() {
  try {
    const filePath = path.resolve(__dirname, '..', 'data', 'leetcode_problems.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw).problems || [];
  } catch (err) {
    console.warn('⚠️ Could not load leetcode_problems.json fallback:', err.message);
    return [];
  }
}

/**
 * GET /api/leetcode/problems
 * Query parameters:
 *  - topic (e.g., 'recursion', 'objects', etc.)
 *  - difficulty ('Easy', 'Medium', 'Hard')
 *  - search (free text search across title, slug, leetcode_id, tags)
 *  - tag (filter by specific tag, e.g., 'Recursion', 'Hash Table')
 */
router.get('/problems', async (req, res) => {
  try {
    const { topic, difficulty, search, tag } = req.query;

    let dbProblems = await LeetCodeProblem.find({ is_active: true }).sort({ sort_order: 1, leetcode_id: 1 }).lean();

    if (!dbProblems || dbProblems.length === 0) {
      dbProblems = getFallbackProblems();
    }

    let filtered = dbProblems;

    // Filter by Topic (many-to-many relationship)
    if (topic && topic !== 'all') {
      filtered = filtered.filter(p => p.topics && p.topics.includes(topic));
    }

    // Filter by Difficulty
    if (difficulty && difficulty !== 'all') {
      filtered = filtered.filter(p => p.difficulty && p.difficulty.toLowerCase() === difficulty.toLowerCase());
    }

    // Filter by Tag
    if (tag && tag !== 'all') {
      filtered = filtered.filter(p => p.tags && p.tags.some(t => t.toLowerCase() === tag.toLowerCase()));
    }

    // Filter by Search Query
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(p => {
        const titleMatch = p.title && p.title.toLowerCase().includes(q);
        const idMatch = p.leetcode_id && String(p.leetcode_id).includes(q);
        const descMatch = p.description_short && p.description_short.toLowerCase().includes(q);
        const tagMatch = p.tags && p.tags.some(t => t.toLowerCase().includes(q));
        return titleMatch || idMatch || descMatch || tagMatch;
      });
    }

    // Collect all available unique tags, topic counts, and difficulty counts for front-end UI
    const allTagsSet = new Set();
    const topicCounts = {};
    const diffCounts = { Easy: 0, Medium: 0, Hard: 0 };

    dbProblems.forEach(p => {
      if (Array.isArray(p.tags)) {
        p.tags.forEach(t => allTagsSet.add(t));
      }
      if (p.difficulty && diffCounts[p.difficulty] !== undefined) {
        diffCounts[p.difficulty]++;
      }
      if (Array.isArray(p.topics)) {
        p.topics.forEach(tid => {
          topicCounts[tid] = (topicCounts[tid] || 0) + 1;
        });
      }
    });

    res.json({
      success: true,
      count: filtered.length,
      total: dbProblems.length,
      problems: filtered,
      tags: Array.from(allTagsSet).sort(),
      topicCounts,
      diffCounts
    });
  } catch (err) {
    console.warn('⚠️ LeetCode API query error, using fallback JSON:', err.message);
    const allFallback = getFallbackProblems();
    let fallback = allFallback;

    const { topic, difficulty, search, tag } = req.query;
    if (topic && topic !== 'all') fallback = fallback.filter(p => p.topics && p.topics.includes(topic));
    if (difficulty && difficulty !== 'all') fallback = fallback.filter(p => p.difficulty && p.difficulty.toLowerCase() === difficulty.toLowerCase());
    if (tag && tag !== 'all') fallback = fallback.filter(p => p.tags && p.tags.some(t => t.toLowerCase() === tag.toLowerCase()));
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      fallback = fallback.filter(p => p.title.toLowerCase().includes(q) || String(p.leetcode_id).includes(q));
    }

    const fallbackTopicCounts = {};
    const fallbackDiffCounts = { Easy: 0, Medium: 0, Hard: 0 };
    allFallback.forEach(p => {
      if (p.difficulty && fallbackDiffCounts[p.difficulty] !== undefined) fallbackDiffCounts[p.difficulty]++;
      if (Array.isArray(p.topics)) {
        p.topics.forEach(tid => {
          fallbackTopicCounts[tid] = (fallbackTopicCounts[tid] || 0) + 1;
        });
      }
    });

    res.json({
      success: true,
      count: fallback.length,
      total: allFallback.length,
      problems: fallback,
      tags: ["Array", "Binary Search", "Hash Table", "JavaScript", "Linked List", "Math", "Recursion", "Stack", "String", "Tree", "Two Pointers"],
      topicCounts: fallbackTopicCounts,
      diffCounts: fallbackDiffCounts
    });
  }
});

/**
 * GET /api/leetcode/problems/:slug
 */
router.get('/problems/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    let problem = await LeetCodeProblem.findOne({ slug }).lean();

    if (!problem) {
      const fallback = getFallbackProblems();
      problem = fallback.find(p => p.slug === slug || String(p.leetcode_id) === slug);
    }

    if (!problem) {
      return res.status(404).json({ success: false, error: 'LeetCode problem not found.' });
    }

    res.json({ success: true, problem });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/leetcode/solved
 * Protected route — returns all problem slugs solved by the current user.
 */
router.get('/solved', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const records = await UserLeetCodeSolved.find({ userId }).lean();
    const solvedSlugs = records.map(r => r.problemSlug);
    res.json({ success: true, solvedSlugs });
  } catch (err) {
    console.error('❌ GET /api/leetcode/solved error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/leetcode/solved/:slug
 * Protected route — mark or unmark a problem as solved for the current user.
 * Body: { solved: true | false }
 */
router.post('/solved/:slug', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { slug } = req.params;
    const { solved } = req.body;

    if (typeof solved !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: '"solved" must be a boolean.'
      });
    }

    if (solved) {
      await UserLeetCodeSolved.updateOne(
        { userId, problemSlug: slug },
        { $set: { userId, problemSlug: slug, solvedAt: new Date() } },
        { upsert: true }
      );
    } else {
      await UserLeetCodeSolved.deleteOne({ userId, problemSlug: slug });
    }

    console.log(`✅ [LC SOLVED] User: ${userId} | Problem: ${slug} | Solved: ${solved}`);
    res.json({ success: true, slug, solved });
  } catch (err) {
    console.error('❌ POST /api/leetcode/solved/:slug error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

