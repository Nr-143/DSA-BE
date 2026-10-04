const mongoose = require('mongoose');

const ProgressSchema = new mongoose.Schema({
  topicId: { type: String, required: true, unique: true },
  completed: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Progress', ProgressSchema);
