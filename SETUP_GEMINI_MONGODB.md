# Setup Guide: Gemini AI + MongoDB Atlas (5 Minutes)

## What Was Changed

Removed all mock data. System now:
- Uses **Gemini API** (Google AI Studio) for real idea generation
- Connects to **MongoDB Atlas** cloud database
- Validates configuration at startup (fails loudly, never silently)

## Prerequisites

- Node.js 18+
- pnpm
- Free tier account at https://cloud.mongodb.com
- Free tier API key from https://aistudio.google.com/apikey

## Setup Steps

### Step 1: Get MongoDB Atlas Connection String (2 min)

```bash
# 1. Go to https://cloud.mongodb.com
# 2. Login or create account
# 3. Click "Database" → "Create" (select Free Tier)
# 4. Click "Connect" → "Drivers" → Node.js
# 5. Copy connection string
# 6. NOTE: Replace <password> with your database password
```

Connection string looks like:
```
mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/cms-production?retryWrites=true&w=majority
```

### Step 2: Whitelist Your IP (1 min)

```bash
# In MongoDB Atlas:
# 1. Click "Network Access" (left sidebar)
# 2. Click "Add IP Address"
# 3. For dev: "Allow access from anywhere" (0.0.0.0/0)
# 4. Production: Use specific IP
```

### Step 3: Get Gemini API Key (1 min)

```bash
# 1. Go to https://aistudio.google.com/apikey
# 2. Click "Create API key"
# 3. Copy the key
# 4. NOTE: Free tier allows ~10 requests/minute
```

### Step 4: Configure .env (1 min)

```bash
# Copy template
cp .env.example .env

# Edit .env with your values:
MONGODB_URI=mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/cms-production?retryWrites=true&w=majority
GEMINI_API_KEY=your-key-from-aistudio
AI_PROVIDER=gemini
GEMINI_MODEL=gemini-2.5-flash
```

### Step 5: Install & Run (1 min)

```bash
# Install dependencies
pnpm install

# Start both frontend + backend
npm run dev:full

# Check logs for:
# [Server] Validating AI configuration...
# [AI Config] Provider: gemini, Model: gemini-2.5-flash
# [MongoDB] Connected successfully to Atlas/MongoDB
```

## Test It

1. Open http://localhost:3000
2. Go to "Concept & Ideation" → "Product Briefs"
3. Create a test product
4. Go to "Idea Bank" → Click "Generate Ideas"
5. Select product → "Generate Ideas"
6. **Watch it generate real ideas** (10-20 seconds)

## Troubleshooting

### "FATAL: AI provider not configured"
→ Check `.env` has `GEMINI_API_KEY` set (not empty)

### "Cannot connect to MongoDB"
→ Check:
- Connection string in `.env`
- IP whitelisted in MongoDB Atlas Network Access
- Password URL-encoded if it has special characters

### "Rate limit exceeded"
→ Free tier limit is ~10 requests/minute. Wait 1 minute and retry.

### "Content blocked by safety filter"
→ Gemini blocked the response. Try different product description.

## What Changed in Code

| What | Before | After |
|------|--------|-------|
| Idea generation | Mock local data | Real Gemini API |
| Database | Local MongoDB | Cloud MongoDB Atlas |
| API key handling | Not needed | From aistudio.google.com |
| Error handling | Silent fallback | Fail-fast, explicit errors |

## Documentation

- **QUICKSTART.md** - Complete setup guide
- **GEMINI_INTEGRATION_NOTES.md** - Technical details
- **IMPLEMENTATION_COMPLETE.md** - What was changed
- **.env.example** - All configuration options

## Key Features

✓ No mock data anywhere
✓ Real Gemini API generation
✓ MongoDB Atlas cloud storage
✓ Fail-fast configuration (catches errors early)
✓ Production-ready error handling
✓ Credentials never logged

## Next Steps

1. Seed database: `npm run seed`
2. Test idea generation in frontend
3. Check MongoDB Atlas to verify data saved
4. Deploy to production when ready

---

**Need help?** Check GEMINI_INTEGRATION_NOTES.md for detailed error messages and troubleshooting.
