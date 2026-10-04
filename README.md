# DSA Tracker — Backend API (MongoDB)

Standalone Express + MongoDB backend for the DSA Tracker app.

## Quick Start

```bash
# Install dependencies
npm install

# (Optional) Seed MongoDB with canonical topic data
npm run seed

# Run in development mode (auto-restarts on file changes)
npm run dev

# Or run directly
npm start
```

The server starts on **http://localhost:3001** by default.

## API Endpoints

| Method  | Route                      | Description                              |
|---------|----------------------------|------------------------------------------|
| `GET`   | `/api/topics`              | Returns the full topic list from MongoDB |
| `GET`   | `/api/progress`            | Returns completed topic IDs from MongoDB |
| `PATCH` | `/api/progress/:topicId`   | Mark a topic as complete/incomplete      |
| `GET`   | `/api/health`              | Health check                             |

### Example: Mark a topic complete

```bash
curl -X PATCH http://localhost:3001/api/progress/primitives \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'
```

## Environment Variables

Copy `.env.example` to `.env` and set `MONGODB_URI`:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/dsa_tracker
PORT=3001
```
