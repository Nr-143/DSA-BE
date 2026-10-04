const mongoose = require('mongoose');

const SubtopicSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  completed: { type: Boolean, default: false }
}, { _id: false });

const TopicSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  level: { type: Number, required: true },
  levelTitle: { type: String, required: true },
  order: { type: Number, required: true },
  completed: { type: Boolean, default: false },
  subtopics: [SubtopicSchema]
}, { timestamps: true });

module.exports = mongoose.model('Topic', TopicSchema);
