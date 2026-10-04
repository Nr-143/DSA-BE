require('dotenv').config();
const fs = require('fs');
const path = require('path');
const connectDB = require('./config/db');
const Topic = require('./models/Topic');
const Progress = require('./models/Progress');
const Note = require('./models/Note');

const sampleNotes = [
  {
    topicId: 'variables-and-memory',
    html: `
      <div class="db-notes-content">
        <h3>📝 Handwritten Notes Summary: Variables & Memory</h3>
        <p><strong>Core Takeaways:</strong></p>
        <ul>
          <li>Primitives live directly on the <strong>Stack</strong> by value.</li>
          <li>Objects and arrays live on the <strong>Heap</strong>; variables store 64-bit reference addresses.</li>
          <li><code>const</code> protects variable binding on Stack, NOT heap contents.</li>
        </ul>
        <blockquote style="border-left: 3px solid var(--accent-primary); padding-left: 12px; margin: 12px 0; color: var(--text-secondary);">
          "Always remember: Mutating an object property mutates memory for all variables sharing that reference!"
        </blockquote>
      </div>
    `
  },
  {
    topicId: 'time-complexity',
    html: `
      <div class="db-notes-content">
        <h3>📝 Handwritten Notes Summary: Time Complexity (Big-O)</h3>
        <p><strong>Growth Order Cheat Sheet:</strong></p>
        <p><code>O(1) &lt; O(log n) &lt; O(n) &lt; O(n log n) &lt; O(n²) &lt; O(2ⁿ) &lt; O(n!)</code></p>
        <ul>
          <li>Drop constants: <code>O(3n + 5) → O(n)</code></li>
          <li>Drop non-dominant terms: <code>O(n² + 100n) → O(n²)</code></li>
          <li>Sequential loops add: <code>O(n + m)</code>; Nested loops multiply: <code>O(n × m)</code></li>
        </ul>
      </div>
    `
  }
];

const seedData = async () => {
  const connected = await connectDB();
  if (!connected) {
    console.error('❌ Could not connect to MongoDB for seeding.');
    process.exit(1);
  }

  try {
    const rawData = fs.readFileSync(path.join(__dirname, 'data', 'topics.json'), 'utf-8');
    const { topics } = JSON.parse(rawData);

    // Clear existing collections
    await Topic.deleteMany({});
    await Progress.deleteMany({});
    await Note.deleteMany({});

    // Insert topics
    await Topic.insertMany(topics);

    // Populate initial progress
    const initialProgress = topics.map(t => ({
      topicId: t.id,
      completed: t.completed
    }));
    await Progress.insertMany(initialProgress);

    // Seed notes
    await Note.insertMany(sampleNotes);

    console.log(`✅ MongoDB Seeded Successfully! (${topics.length} topics, ${sampleNotes.length} notes seeded)`);
    process.exit(0);
  } catch (err) {
    console.error(`❌ Seeding failed: ${err.message}`);
    process.exit(1);
  }
};

seedData();
