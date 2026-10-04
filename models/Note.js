const mongoose = require('mongoose');

const NoteSchema = new mongoose.Schema({
  topicId: { type: String, required: true, unique: true },
  html: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Note', NoteSchema);
