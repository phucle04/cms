# Running the CMS App Locally - Complete Guide

## Prerequisites

Make sure you have installed:
- **Node.js 18+** (download from https://nodejs.org/)
- **pnpm** - Install globally: `npm install -g pnpm`
- **Git** (for cloning if needed)
- A code editor (VS Code recommended)

Verify installations:
```bash
node --version      # Should be v18 or higher
pnpm --version      # Should be v8 or higher
```

## Step 1: Clone/Download the Project

If you have the project folder already, skip to Step 2.

```bash
# Navigate to where you want the project
cd ~/projects

# Clone or extract the project
git clone <your-repo-url>  # if using git
# OR extract the downloaded ZIP file
```

## Step 2: Install Dependencies

```bash
# Navigate to project directory
cd cms-project

# Install all dependencies (frontend + backend)
pnpm install

# This will install ~200+ packages, takes 2-3 minutes
```

## Step 3: Setup MongoDB Atlas (Required - Free Tier Available)

MongoDB Atlas is a cloud database service. You need this because the app uses MongoDB to store all data.

### 3a. Create MongoDB Atlas Account

1. Go to https://cloud.mongodb.com
2. Click "Sign Up" or "Sign In"
3. Create account (or login if you have one)
4. Complete verification email

### 3b. Create a Database Cluster

1. Click **"Database"** in left sidebar
2. Click **"Create"** button
3. Select **"Free" tier** (M0 - good for development)
4. Choose region closest to you
5. Click **"Create Cluster"** (takes 2-3 minutes to deploy)

### 3c. Create Database User

1. Wait for cluster to finish creating
2. Click **"Database Access"** in left sidebar
3. Click **"Add New Database User"**
4. Enter username: `admin`
5. Enter password: `YourStrongPassword123` (remember this!)
6. Click **"Add User"**

### 3d. Get Connection String

1. Click **"Database"** → Click **"Connect"** button
2. Click **"Drivers"** → Select **"Node.js"**
3. Copy the connection string
4. Replace `<username>` with `admin`
5. Replace `<password>` with your password from step 3c
6. It looks like: `mongodb+srv://admin:YourStrongPassword123@cluster0.xxxxx.mongodb.net/cms-production?retryWrites=true&w=majority`

### 3e. Whitelist Your IP

1. Go to **"Network Access"** in left sidebar
2. Click **"Add IP Address"**
3. For local development: Click **"Allow access from anywhere"** (0.0.0.0/0)
4. Click **"Confirm"**

⚠️ **Note:** "Allow from anywhere" is only for development. For production, use your specific IP.

## Step 4: Get Gemini API Key

Gemini is Google's AI that generates content ideas.

1. Go to https://aistudio.google.com/apikey
2. Click **"Create API key"**
3. Copy the key
4. Keep it safe (don't share it)

**Note:** Free tier allows ~10 requests per minute.

## Step 5: Create .env File

### 5a. Optional: Configure TikTok trend provider
If you want the new Trend Research module to use live TikTok data instead of mock fallback, register an account with a provider such as Apify and add the values below to your `.env` file:

```env
TIKTOK_PROVIDER=apify
APIFY_API_TOKEN=your-token
APIFY_TIKTOK_ACTOR_ID=clockworks~tiktok-scraper
```

If these values are left empty, the app will still run and use mock data for local testing.

Create a `.env` file in the project root with your credentials:

```bash
# In project root directory, create .env file:
# Copy from .env.example
cp .env.example .env

# Edit .env with your values (use any text editor)
```

Edit `.env` file and add:

```env
# MongoDB Atlas Connection String
MONGODB_URI=mongodb+srv://admin:YourStrongPassword123@cluster0.xxxxx.mongodb.net/cms-production?retryWrites=true&w=majority

# Gemini API Configuration
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-2.5-flash

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Server Configuration
PORT=5000
NODE_ENV=development

# JWT Secret (change in production)
JWT_SECRET=your-dev-secret-key-here

# Other settings
ENABLE_AUTO_ARCHIVE=true
AUTO_ARCHIVE_DAYS=90
ENABLE_AUTO_RANK=true
```

**Replace:**
- `admin:YourStrongPassword123@cluster0.xxxxx.mongodb.net` with your MongoDB connection string
- `your-gemini-api-key-here` with your Gemini API key

## Step 6: Start the Development Servers

Open a terminal in the project directory and run:

```bash
# Start BOTH frontend and backend
npm run dev:full

# Wait for both to start:
# Frontend: http://localhost:3000 (Next.js)
# Backend: http://localhost:5000 (Express)
```

You should see output like:
```
> next dev
  ▲ Next.js 16.x
  - Local: http://localhost:3000

> tsx watch server/index.ts
[Server] Validating AI configuration...
[AI Config] Provider: gemini, Model: gemini-2.5-flash
[MongoDB] Connected successfully to Atlas/MongoDB
[Server] Started on port 5000
```

## Step 7: Open the App

1. Open your browser
2. Go to http://localhost:3000
3. You should see the CMS dashboard

## Step 8: Test the System

### Populate Sample Data

```bash
# In a NEW terminal (keep dev server running):
npm run seed

# This creates sample products, trends, etc.
```

### Generate Ideas with Gemini AI

1. Click **"Concept & Ideation"** in the sidebar
2. Go to **"Product Briefs"** tab
3. Click **"New Product Brief"**
4. Fill in details:
   - Name: "Coffee Maker"
   - Category: "Kitchen"
   - USP: "Brews perfect coffee in 30 seconds"
   - Pain Points: "Morning rush, inconsistent quality"
5. Click **"Create"**
6. Go to **"Idea Bank"** tab
7. Click **"Generate Ideas"**
8. Select your product
9. Click **"Generate Ideas"**
10. **Wait 10-20 seconds** - Gemini creates real ideas!

### Check MongoDB

Verify data was saved:

1. Go to https://cloud.mongodb.com
2. Click **"Database"** → **"Browse Collections"**
3. You should see collections like:
   - `productbriefs` (your product)
   - `ideas` (generated ideas)
   - `videokpis` (if you logged KPIs)
   - etc.

## Troubleshooting

### "Cannot connect to MongoDB"

```
Error: Cannot connect to MongoDB
Solution:
1. Check MongoDB Atlas connection string in .env
2. Verify username:password are correct
3. Check IP is whitelisted in Network Access
4. Verify MongoDB cluster is running (check dashboard)
```

### "Gemini API key not configured"

```
Error: FATAL: GEMINI_API_KEY is missing
Solution:
1. Check .env has GEMINI_API_KEY set (not empty)
2. Verify you copied the full key from aistudio.google.com
3. No spaces before/after the key
```

### "Rate limit exceeded"

```
Error: Gemini rate limit exceeded (429)
Solution:
1. Free tier allows ~10 requests per minute
2. Wait 1 minute and try again
3. For more requests, upgrade Gemini API plan
```

### "Safety filter blocked the response"

```
Error: Content blocked by AI safety filter
Solution:
1. Gemini blocked your product description
2. Try different wording for product details
3. Avoid marketing claims that might trigger filters
```

### Port 3000 or 5000 Already in Use

```bash
# If port 3000 is taken:
PORT=3001 npm run dev

# If port 5000 is taken:
PORT=5001 npm run server:dev
```

## Project Structure

```
project/
├── app/                    # Frontend pages (Next.js)
│   ├── page.tsx           # Dashboard
│   ├── ideation/          # Idea generation
│   ├── research/          # Research & strategy
│   ├── analytics/         # Analytics
│   └── ...
├── server/                # Backend API
│   ├── models/            # MongoDB schemas
│   ├── controllers/       # API logic
│   ├── routes/            # API endpoints
│   ├── services/          # Business logic
│   └── index.ts           # Entry point
├── components/            # Reusable UI components
├── lib/                   # Utilities and helpers
├── .env                   # Your credentials (don't commit)
├── .env.example           # Template (safe to commit)
└── package.json           # Dependencies
```

## Common Commands

```bash
# Start both frontend and backend
npm run dev:full

# Start only backend (if frontend has issues)
npm run server:dev

# Start only frontend (if backend has issues)
npm run dev

# Populate with sample data
npm run seed

# Build for production
npm run build

# See all available commands
pnpm run
```

## Next Steps

1. **Explore the Dashboard** - Navigate all modules
2. **Create Test Data** - Add products, ideas, etc.
3. **Test AI Generation** - Generate ideas with Gemini
4. **Log Analytics** - Add KPIs and check auto-ranking
5. **Learn the API** - Check `/api/health` endpoint

## Database Backup

MongoDB Atlas automatically backs up your data. To export:

1. Go to cluster → **"Tools"** → **"Export Data"**
2. Choose collection and format (JSON, CSV)
3. Download your backup

## When You're Done

To stop the servers:

```bash
# Press Ctrl+C in the terminal
# This stops both frontend and backend
```

## Need Help?

- Check **GEMINI_INTEGRATION_NOTES.md** for technical details
- Check **API_SPECIFICATION.md** for API endpoints
- Check **QUICKSTART.md** for quick reference

---

**Your local CMS system is now ready to use!** 🚀

Questions? The documentation files have detailed troubleshooting sections.
