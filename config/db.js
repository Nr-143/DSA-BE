const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

/* ────────── Mongoose MongoDB Schemas & Models ────────── */
const MongoUser = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  name: { type: String },
  picture: { type: String },
  ip: { type: String },
  os: { type: String },
  user_agent: { type: String },
  created_at: { type: String },
  last_login_at: { type: String }
}, { collection: 'users' }));

const MongoOtpCode = mongoose.models.OtpCode || mongoose.model('OtpCode', new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  code_hash: { type: String, required: true },
  expires_at: { type: String, required: true },
  consumed: { type: Number, default: 0 },
  attempt_count: { type: Number, default: 0 },
  created_at: { type: String }
}, { collection: 'otp_codes' }));

const MongoSession = mongoose.models.Session || mongoose.model('Session', new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  user_id: { type: String, required: true },
  refresh_token_hash: { type: String, required: true },
  ip: { type: String },
  os: { type: String },
  user_agent: { type: String },
  created_at: { type: String },
  expires_at: { type: String },
  revoked: { type: Number, default: 0 }
}, { collection: 'sessions' }));

const MongoUserProgress = mongoose.models.UserProgress || mongoose.model('UserProgress', new mongoose.Schema({
  user_id: { type: String, required: true },
  topic_id: { type: String, required: true },
  completed_at: { type: String }
}, { collection: 'user_progress' }));

/**
 * Initialize MongoDB Connection and Auto-Seed Topics
 */
async function initDB() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is missing in server/.env file!');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log(`🍃 Connected to MongoDB Database at ${mongoUri}`);
    await fixProgressIndexes();
    await autoSeedTopics();
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
  }
}

/**
 * Drop legacy single-field topicId_1 index and sync compound index (userId + topicId)
 */
async function fixProgressIndexes() {
  try {
    const Progress = require('../models/Progress');
    // Delete legacy progress records that lack userId
    await Progress.deleteMany({ userId: { $exists: false } });

    // Check if legacy single-field index topicId_1 exists, and drop it
    const indexes = await Progress.collection.indexes();
    const hasLegacyIndex = indexes.some(idx => idx.name === 'topicId_1');
    if (hasLegacyIndex) {
      await Progress.collection.dropIndex('topicId_1');
      console.log('🧹 Dropped legacy single-field index topicId_1 from progresses collection.');
    }

    // Re-sync Mongoose schema indexes (creates compound index userId_1_topicId_1)
    await Progress.syncIndexes();
    console.log('✅ Synchronized compound index { userId: 1, topicId: 1 } for Progress collection.');
  } catch (err) {
    console.warn('⚠️ Progress index sync warning:', err.message);
  }
}

/**
 * Auto-seed topics from topics.json if topics collection is empty
 */
async function autoSeedTopics() {
  try {
    const Topic = require('../models/Topic');
    // Ensure legacy global completed fields are removed from topics collection
    await Topic.updateMany({}, { $unset: { completed: "", subtopics: "" } });

    const count = await Topic.countDocuments({});
    if (count === 0) {
      const topicsFilePath = path.join(__dirname, '..', 'data', 'topics.json');
      if (fs.existsSync(topicsFilePath)) {
        const raw = fs.readFileSync(topicsFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.topics && Array.isArray(parsed.topics)) {
          const cleanTopics = parsed.topics.map(t => ({
            id: t.id,
            title: t.title,
            level: t.level,
            levelTitle: t.levelTitle,
            order: t.order
          }));
          await Topic.insertMany(cleanTopics);
          console.log(`🌱 Auto-seeded ${cleanTopics.length} topics into MongoDB 'topics' collection.`);
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ Auto-seeding topics check warning:', err.message);
  }
}

/**
 * Unified Query Execution Helper for MongoDB
 * Returns array of row objects
 */
async function query(sql, params = []) {
  const cleanSql = sql.trim().replace(/\s+/g, ' ');

  if (cleanSql.includes('FROM otp_codes')) {
    const email = params[0];
    const nowIso = params[1];
    const doc = await MongoOtpCode.findOne({
      email,
      consumed: 0,
      expires_at: { $gt: nowIso }
    }).sort({ created_at: -1 }).lean();
    return doc ? [doc] : [];
  }

  if (cleanSql.includes('FROM users WHERE email =')) {
    const doc = await MongoUser.findOne({ email: params[0] }).lean();
    return doc ? [doc] : [];
  }

  if (cleanSql.includes('FROM users WHERE id =')) {
    const doc = await MongoUser.findOne({ id: params[0] }).lean();
    return doc ? [doc] : [];
  }

  if (cleanSql.includes('FROM sessions')) {
    const tokenHash = params[0];
    const nowIso = params[1];
    const doc = await MongoSession.findOne({
      refresh_token_hash: tokenHash,
      revoked: 0,
      expires_at: { $gt: nowIso }
    }).lean();
    return doc ? [doc] : [];
  }

  if (cleanSql.includes('FROM user_progress')) {
    const userId = params[0];
    const docs = await MongoUserProgress.find({ user_id: userId }).lean();
    return docs;
  }

  return [];
}

/**
 * Single Row Helper
 */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

/**
 * Run statement (insert/update/delete) for MongoDB
 */
async function execute(sql, params = []) {
  const cleanSql = sql.trim().replace(/\s+/g, ' ');

  if (cleanSql.startsWith('INSERT INTO otp_codes')) {
    const [id, email, code_hash, expires_at, consumed, attempt_count, created_at] = params;
    await MongoOtpCode.create({ id, email, code_hash, expires_at, consumed: consumed || 0, attempt_count: attempt_count || 0, created_at });
    return { changes: 1 };
  }

  if (cleanSql.includes('UPDATE otp_codes SET consumed = 1')) {
    const id = params[0];
    const res = await MongoOtpCode.updateOne({ id }, { $set: { consumed: 1 } });
    return { changes: res.modifiedCount };
  }

  if (cleanSql.includes('UPDATE otp_codes SET attempt_count =')) {
    const [attempt_count, id] = params;
    const res = await MongoOtpCode.updateOne({ id }, { $set: { attempt_count } });
    return { changes: res.modifiedCount };
  }

  if (cleanSql.startsWith('INSERT INTO users')) {
    let [id, email, name, picture, ip, os, user_agent, created_at, last_login_at] = params;
    await MongoUser.create({ id, email, name, picture, ip, os, user_agent, created_at, last_login_at });
    return { changes: 1 };
  }

  if (cleanSql.startsWith('UPDATE users SET last_login_at =')) {
    let [last_login_at, name, picture, ip, os, user_agent, id] = params;
    if (!id && params.length === 2) {
      id = params[1];
      await MongoUser.updateOne({ id }, { $set: { last_login_at } });
    } else {
      await MongoUser.updateOne({ id }, { $set: { last_login_at, name, picture, ip, os, user_agent } });
    }
    return { changes: 1 };
  }

  if (cleanSql.startsWith('INSERT INTO sessions')) {
    const [id, user_id, refresh_token_hash, ip, os, user_agent, created_at, expires_at, revoked] = params;
    await MongoSession.create({ id, user_id, refresh_token_hash, ip, os, user_agent, created_at, expires_at, revoked: revoked || 0 });
    return { changes: 1 };
  }

  if (cleanSql.includes('UPDATE sessions SET revoked = 1')) {
    const id = params[0];
    const res = await MongoSession.updateOne({ id }, { $set: { revoked: 1 } });
    return { changes: res.modifiedCount };
  }

  if (cleanSql.startsWith('DELETE FROM user_progress')) {
    const [user_id, topic_id] = params;
    const res = await MongoUserProgress.deleteMany({ user_id, topic_id });
    return { changes: res.deletedCount };
  }

  if (cleanSql.startsWith('INSERT INTO user_progress')) {
    const [user_id, topic_id, completed_at] = params;
    await MongoUserProgress.create({ user_id, topic_id, completed_at });
    return { changes: 1 };
  }

  return { changes: 0 };
}

module.exports = {
  initDB,
  query,
  queryOne,
  execute,
  MongoUser,
  MongoOtpCode,
  MongoSession,
  MongoUserProgress
};
