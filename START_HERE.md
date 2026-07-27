# START HERE - Running Your CMS Locally

## 30-Second Overview

This is a **complete Content Management System** with:
- Frontend (Next.js) at `localhost:3000`
- Backend API (Express) at `localhost:5000`
- Database (MongoDB Atlas cloud)
- AI (Gemini API) for content generation

## Quick Start (15-20 minutes)

### 1. Prerequisites
- Node.js 18+
- pnpm
- Free MongoDB Atlas account
- Free Gemini API key

### 2. Get Credentials

**MongoDB Atlas:**
1. Go to https://cloud.mongodb.com
2. Create account and free cluster
3. Get connection string (save it)
4. Whitelist your IP

**Gemini API:**
1. Go to https://aistudio.google.com/apikey
2. Create API key (save it)

### 3. Configure Project

```bash
# In project directory:
cp .env.example .env

# Edit .env with your credentials:
# - MONGODB_URI = your connection string
# - GEMINI_API_KEY = your API key
```

### 4. Install & Run

```bash
pnpm install
npm run dev:full
```

### 5. Visit App

Open http://localhost:3000

## What You Can Do

- **Dashboard** - See system overview
- **Research & Strategy** - Manage brand voice, trends, competitors
- **Ideation** - Create products and generate ideas with AI
- **Scripting** - Write video scripts
- **Analytics** - Track KPIs and performance
- **Archive** - Manage old items

## Test AI Generation

1. Go to "Concept & Ideation"
2. Create a product
3. Click "Generate Ideas"
4. Watch Gemini create real ideas in 10-20 seconds

## File Locations for Setup

| File | Purpose | Edit? |
|------|---------|-------|
| `.env.example` | Template | No, read only |
| `.env` | Your config | Yes, add credentials |
| `LOCAL_SETUP.md` | Detailed guide | No, reference |
| `SETUP_CHECKLIST.md` | Step-by-step | No, checklist |
| `GEMINI_INTEGRATION_NOTES.md` | Technical | No, reference |

## Detailed Guides

- **LOCAL_SETUP.md** - Complete step-by-step setup guide
- **SETUP_CHECKLIST.md** - Checklist to follow
- **QUICKSTART.md** - Quick reference
- **GEMINI_INTEGRATION_NOTES.md** - Technical details
- **API_SPECIFICATION.md** - API endpoints

## Common Commands

```bash
# Start everything
npm run dev:full

# Just backend
npm run server:dev

# Just frontend
npm run dev

# Seed test data
npm run seed

# Build for production
npm run build
```

## Project Structure

```
project/
├── app/              # Frontend pages
├── server/           # Backend API
├── components/       # UI components
├── lib/              # Utilities
├── .env              # Your credentials
└── LOCAL_SETUP.md    # This guide
```

## Troubleshooting

**"Cannot connect to MongoDB"**
- Check MongoDB Atlas connection string
- Verify IP is whitelisted
- Check username/password

**"Gemini API not configured"**
- Check .env has GEMINI_API_KEY
- Verify it's not empty or truncated

**"Rate limit exceeded"**
- Free tier = 10 requests/minute
- Wait 1 minute and retry

## Next Steps

1. Follow **LOCAL_SETUP.md** for detailed instructions
2. Use **SETUP_CHECKLIST.md** as you go
3. Test Gemini AI generation
4. Explore all modules
5. Read **API_SPECIFICATION.md** to understand endpoints

## Need Help?

- **Setup issues?** → Read LOCAL_SETUP.md troubleshooting
- **API questions?** → Check API_SPECIFICATION.md
- **Technical details?** → See GEMINI_INTEGRATION_NOTES.md
- **Quick reference?** → Use SETUP_CHECKLIST.md

---

**Ready to start?** → Open LOCAL_SETUP.md now and follow the steps.

**Have questions?** → Each guide has a troubleshooting section.

**Want to deploy?** → Check DEPLOYMENT.md when ready.

Good luck! 🚀
