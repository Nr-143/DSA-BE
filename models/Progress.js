const mongoose = require('mongoose');

const ProgressSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  topicId: { type: String, required: true },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date }
}, { timestamps: true });

ProgressSchema.index({ userId: 1, topicId: 1 }, { unique: true });

module.exports = mongoose.model('Progress', ProgressSchema);
