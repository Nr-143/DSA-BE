const mongoose = require('mongoose');

/**
 * Tracks per-user solved LeetCode problems.
 * Scoped strictly to (userId + problemSlug) compound key.
 */
const UserLeetCodeSolvedSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  problemSlug: { type: String, required: true },
  solvedAt: { type: Date, default: Date.now }
}, { timestamps: true });

UserLeetCodeSolvedSchema.index({ userId: 1, problemSlug: 1 }, { unique: true });

module.exports = mongoose.model('UserLeetCodeSolved', UserLeetCodeSolvedSchema);
