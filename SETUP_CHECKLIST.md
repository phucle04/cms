# Local Setup Checklist

Follow this checklist to run the app on your local machine.

## Before You Start

- [ ] Node.js 18+ installed (`node --version`)
- [ ] pnpm installed (`pnpm --version`)
- [ ] Git installed (if cloning)
- [ ] Text editor ready (VS Code recommended)
- [ ] Internet connection (for MongoDB Atlas & Gemini)

## Phase 1: MongoDB Atlas Setup (5 minutes)

- [ ] Create account at https://cloud.mongodb.com
- [ ] Create free M0 cluster
- [ ] Create database user (username: `admin`)
- [ ] Save password somewhere safe
- [ ] Get connection string from "Drivers" page
- [ ] Whitelist your IP (0.0.0.0/0 for development)
- [ ] Connection string saved

## Phase 2: Gemini API Setup (2 minutes)

- [ ] Go to https://aistudio.google.com/apikey
- [ ] Create new API key
- [ ] Copy and save the key

## Phase 3: Project Setup (5 minutes)

- [ ] Project folder downloaded/cloned
- [ ] Navigate into project: `cd project-folder`
- [ ] Install dependencies: `pnpm install`
- [ ] Copy env template: `cp .env.example .env`
- [ ] Open `.env` in text editor

## Phase 4: Configure .env (2 minutes)

In `.env` file, fill in:

```env
MONGODB_URI=mongodb+srv://admin:PASSWORD@cluster0.xxxxx.mongodb.net/cms-production?retryWrites=true&w=majority
```

Replace:
- [ ] `PASSWORD` with your MongoDB password
- [ ] `cluster0.xxxxx` with your cluster name

```env
GEMINI_API_KEY=your-key-here
```

Replace:
- [ ] `your-key-here` with your Gemini API key

Make sure these are set:
- [ ] `AI_PROVIDER=gemini`
- [ ] `GEMINI_MODEL=gemini-2.5-flash`
- [ ] `FRONTEND_URL=http://localhost:3000`
- [ ] `PORT=5000`
- [ ] `NODE_ENV=development`

## Phase 5: Start the App (1 minute)

- [ ] Terminal in project directory
- [ ] Run: `npm run dev:full`
- [ ] Wait for startup messages
- [ ] See `[Server] Started on port 5000`
- [ ] See `▲ Next.js 16` message

## Phase 6: Verification (2 minutes)

- [ ] Open http://localhost:3000 in browser
- [ ] See CMS dashboard
- [ ] Navigation sidebar visible
- [ ] All modules show (Dashboard, Research, Ideation, etc.)

## Phase 7: Populate Data (Optional - 1 minute)

In a new terminal:
- [ ] Run: `npm run seed`
- [ ] Wait for completion
- [ ] See sample data created

## Phase 8: Test Gemini AI Generation (5 minutes)

1. [ ] Frontend loaded at localhost:3000
2. [ ] Click "Concept & Ideation"
3. [ ] Go to "Product Briefs" tab
4. [ ] Click "New Product Brief"
5. [ ] Fill in product details
6. [ ] Click "Create"
7. [ ] Go to "Idea Bank" tab
8. [ ] Click "Generate Ideas"
9. [ ] Select your product
10. [ ] Click "Generate Ideas"
11. [ ] **Wait 10-20 seconds**
12. [ ] Ideas appear in the list
13. [ ] Ideas have source: "gemini-ai"
14. [ ] Check MongoDB Atlas to see ideas saved

## If Something Goes Wrong

Check these:

### Frontend won't load
- [ ] Port 3000 not blocked
- [ ] Try different port: `PORT=3001 npm run dev`

### Backend won't start
- [ ] MongoDB connection string correct?
- [ ] IP whitelisted in MongoDB Atlas?
- [ ] Gemini API key set in .env?
- [ ] Port 5000 not blocked?

### Ideas generation fails
- [ ] Gemini API key valid?
- [ ] Free tier rate limit? (wait 1 minute)
- [ ] Product description triggering safety filter? (rephrase)

### Still having issues?
- [ ] Read LOCAL_SETUP.md troubleshooting section
- [ ] Check GEMINI_INTEGRATION_NOTES.md
- [ ] Verify all .env variables are filled in
- [ ] Check that no values have quotes

## You're Done! 

Everything is working when:
- ✓ Frontend loads at localhost:3000
- ✓ Dashboard shows all modules
- ✓ Ideas generate in 10-20 seconds
- ✓ Ideas saved to MongoDB Atlas
- ✓ Server logs show no errors

Next:
1. Explore all modules
2. Create more test products
3. Generate more ideas
4. Log KPIs and check analytics
5. Read documentation

---

Total time: ~15-20 minutes including MongoDB & Gemini setup

**Happy coding!** 🚀
