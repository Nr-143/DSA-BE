const mongoose = require('mongoose');

const LeetCodeProblemSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  leetcode_id: { type: Number, required: true },
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], required: true },
  url: { type: String, required: true },
  description_short: { type: String },
  learning_note: { type: String },
  tags: [{ type: String }],
  topics: [{ type: String }],
  is_active: { type: Boolean, default: true },
  sort_order: { type: Number, default: 1 }
}, { timestamps: true });

module.exports = mongoose.model('LeetCodeProblem', LeetCodeProblemSchema);
