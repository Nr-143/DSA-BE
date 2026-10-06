const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const fs = require('fs');
const mongoose = require('mongoose');

const LeetCodeProblem = require('./models/LeetCodeProblem');

async function seedLeetCode() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI missing in server/.env!');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log(`🍃 Connected to MongoDB for LeetCode Seeding.`);

    const filePath = path.join(__dirname, 'data', 'leetcode_problems.json');
    if (!fs.existsSync(filePath)) {
      console.error('❌ server/data/leetcode_problems.json not found!');
      process.exit(1);
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const { problems } = JSON.parse(raw);

    if (!Array.isArray(problems) || problems.length === 0) {
      console.warn('⚠️ No problems found in leetcode_problems.json');
      process.exit(0);
    }

    // Idempotent upsert operations
    const operations = problems.map(p => ({
      updateOne: {
        filter: { id: String(p.id) },
        update: {
          $set: {
            id: String(p.id),
            leetcode_id: Number(p.leetcode_id),
            title: p.title,
            slug: p.slug,
            difficulty: p.difficulty,
            url: p.url,
            description_short: p.description_short,
            learning_note: p.learning_note,
            tags: p.tags || [],
            topics: p.topics || [],
            is_active: p.is_active !== undefined ? p.is_active : true,
            sort_order: p.sort_order || 1
          }
        },
        upsert: true
      }
    }));

    const result = await LeetCodeProblem.bulkWrite(operations);
    console.log(`🌱 Idempotent LeetCode Seeding Complete!`);
    console.log(`   Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}, Matched: ${result.matchedCount}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ LeetCode Seeding Error:', err.message);
    process.exit(1);
  }
}

seedLeetCode();
