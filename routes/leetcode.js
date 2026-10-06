const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const LeetCodeProblem = require('../models/LeetCodeProblem');

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

    // Collect all available unique tags for front-end filter UI
    const allTagsSet = new Set();
    dbProblems.forEach(p => {
      if (Array.isArray(p.tags)) {
        p.tags.forEach(t => allTagsSet.add(t));
      }
    });

    res.json({
      success: true,
      count: filtered.length,
      total: dbProblems.length,
      problems: filtered,
      tags: Array.from(allTagsSet).sort()
    });
  } catch (err) {
    console.warn('⚠️ LeetCode API query error, using fallback JSON:', err.message);
    let fallback = getFallbackProblems();

    const { topic, difficulty, search, tag } = req.query;
    if (topic && topic !== 'all') fallback = fallback.filter(p => p.topics && p.topics.includes(topic));
    if (difficulty && difficulty !== 'all') fallback = fallback.filter(p => p.difficulty && p.difficulty.toLowerCase() === difficulty.toLowerCase());
    if (tag && tag !== 'all') fallback = fallback.filter(p => p.tags && p.tags.some(t => t.toLowerCase() === tag.toLowerCase()));
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      fallback = fallback.filter(p => p.title.toLowerCase().includes(q) || String(p.leetcode_id).includes(q));
    }

    res.json({
      success: true,
      count: fallback.length,
      total: getFallbackProblems().length,
      problems: fallback,
      tags: ["Recursion", "Hash Table", "Array", "String", "Math", "Two Pointers", "JavaScript"]
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

module.exports = router;
