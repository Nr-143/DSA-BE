const mongoose = require('mongoose');

const TopicSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  level: { type: Number, required: true },
  levelTitle: { type: String, required: true },
  order: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Topic', TopicSchema);
