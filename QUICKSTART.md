# Quick Start Guide - CMS with Gemini AI + MongoDB Atlas

Get the complete CMS system running in 10 minutes.

## Prerequisites
- Node.js 18+ 
- pnpm (or npm)
- MongoDB Atlas account (free tier at https://cloud.mongodb.com)
- Gemini API key from https://aistudio.google.com/apikey

## 1. Setup Environment

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
``` 

### 1a. MongoDB Atlas Connection String

1. Go to https://cloud.mongodb.com → Login
2. Click "Database" → "Connect"
3. Choose "Drivers" → Node.js
4. Copy connection string: `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/<dbname>?retryWrites=true&w=majority`
5. **IMPORTANT**: Replace `<user>` and `<password>` with your database credentials
6. Paste into `.env`:
```
MONGODB_URI=mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/cms-production?retryWrites=true&w=majority
```

### 1b. IP Whitelist (MongoDB Atlas Network Access)

1. In MongoDB Atlas dashboard: "Network Access" → "Add IP Address"
2. For development: Click "Allow access from anywhere" (use 0.0.0.0/0)
3. **WARNING**: This is NOT for production - use specific IPs in prod

### 1c. Gemini API Key Configuration

1. Go to https://aistudio.google.com/apikey
2. Create new API key (free tier allows ~10 requests/minute)
3. Paste into `.env`:
```
GEMINI_API_KEY=your-key-here
AI_PROVIDER=gemini
GEMINI_MODEL=gemini-2.5-flash
```

## 2. Seed Database

```bash
npm run seed
```

Creates test data:
- User: test@example.com / password123
- 2 products
- 2 ideas
- 2 trends
- 2 KPIs

## 3. Run Development

### Frontend Only
```bash
npm run dev
```
Opens http://localhost:3000

### Backend Only
```bash
npm run server:dev
```
Runs on http://localhost:5000

### Full Stack (Recommended)
```bash
npm run dev:full
```
Both running concurrently

## 4. Test the System

### Verify Backend Started Correctly
Check server logs for:
```
[Server] Validating AI configuration...
[AI Config] Provider: gemini, Model: gemini-2.5-flash
[MongoDB] Connected successfully to Atlas/MongoDB
[Server] Started on port 5000
```

If you see errors, check:
- Is `.env` set with valid `GEMINI_API_KEY`?
- Is MongoDB Atlas connection string correct in `MONGODB_URI`?
- Is your IP whitelisted in MongoDB Atlas Network Access?

### Frontend - Test Idea Generation with Gemini AI

1. Open http://localhost:3000
2. Go to "Concept & Ideation" → "Product Briefs"
3. Create a test product (or use seeded product)
4. Go to "Idea Bank" → Click "Generate Ideas"
5. Select product → "Generate Ideas"
6. **Watch** as Gemini generates 5 real ideas (10-20 seconds)
7. Check ideas appear with source: "gemini-ai"

### Backend API Test
```bash
# Health check
curl http://localhost:5000/api/health

# Generate ideas (requires auth token)
curl -X POST http://localhost:5000/api/ideas/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt-token>" \
  -d '{ "productId": "<product-id>", "count": 5 }'
```

## 5. Deploy

### Frontend (Vercel)
```bash
npm run build
# Push to GitHub
# Deploy from Vercel dashboard
```

### Backend (Railway)
1. Push to GitHub
2. Create project on Railway
3. Add MongoDB URI and JWT_SECRET
4. Deploy

See DEPLOYMENT.md for detailed steps.

## Project Structure

```
/
├── app/                    # Next.js frontend
│   ├── page.tsx           # Dashboard
│   ├── research/          # Research & Strategy
│   ├── ideation/          # Ideas & Products
│   ├── scripting/         # Scripts
│   ├── optimization/      # Metadata & Thumbnails
│   ├── analytics/         # KPIs & Analysis
│   ├── archive/           # Archive
│   └── settings/          # Configuration
├── components/            # React components
├── lib/                   # Utilities & types
├── server/               # Express backend
│   ├── models/           # 22 Mongoose schemas
│   ├── controllers/      # API handlers
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── middleware/      # Auth, errors
│   └── index.ts         # Server entry
├── BACKEND_SETUP.md     # Backend guide
├── BACKEND_COMPLETE.md  # Complete reference
├── API_SPECIFICATION.md # API docs
├── DEPLOYMENT.md        # Deployment guide
└── QUICKSTART.md        # This file
```

## Key Features

✅ 8 production modules
✅ 22 complete data models
✅ AI-powered generation
✅ Auto-ranking analytics
✅ JWT authentication
✅ Full CRUD operations
✅ Mobile responsive
✅ Dark mode support

## Modules

1. **Dashboard** - Overview & quick actions
2. **Research & Strategy** - Brand voice, personas, trends
3. **Ideation** - Product briefs & content ideas
4. **Scripting** - Script creation & management
5. **Optimization** - Metadata & thumbnails
6. **Analytics** - KPI tracking & analysis
7. **Archive** - Item archiving
8. **Settings** - AI configuration

## API Endpoints

Full CRUD ready for:
- `/api/ideas` - Content ideas
- `/api/products` - Product briefs
- `/api/kpis` - Performance metrics
- `/api/trends` - Market trends
- `/api/competitors` - Competitor data
- `/api/scripts` - Video scripts
- `/api/analytics` - Analysis reports
- ... and more

See API_SPECIFICATION.md for complete list.

## Environment Variables

Required:
```
MONGODB_URI=mongodb://...
JWT_SECRET=random-secret-key
FRONTEND_URL=http://localhost:3000
```

Optional:
```
AI_PROVIDER=openai          # default: mock
AI_API_KEY=sk-...
AI_MODEL=gpt-4              # default: gpt-4
```

## Database

22 Mongoose models with:
- Validation
- Indexing
- Relationships
- Timestamps
- Type safety

All ready for production.

## Troubleshooting

### Backend won't start
```bash
# Check MongoDB is running
# Check MONGODB_URI in .env
# Check port 5000 is available
npm run server:dev
```

### Frontend errors
```bash
# Clear cache and rebuild
rm -rf .next
npm run build
npm run dev
```

### Database seeding fails
```bash
# Check MongoDB connection
# Ensure database is empty (optional: clear it)
npm run seed
```

## Common Tasks

### Create a Product
```
1. Go to Ideation module
2. Click "New Product Brief"
3. Fill form and save
4. Generate ideas with AI
```

### Track Video Performance
```
1. Go to Analytics
2. Click "Log KPI"
3. Enter views, likes, comments
4. System auto-calculates rank
```

### Analyze Performance
```
1. Analytics → Analysis tab
2. Click "Generate Analysis"
3. System analyzes last 30 days
4. Get patterns, gaps, recommendations
```

### Set Brand Guidelines
```
1. Go to Research & Strategy
2. Brand Voice tab
3. Set tone, personality, rules
4. Used in all AI generation
```

## Next Steps

1. **Customize Styling** - Update colors in globals.css
2. **Add Authentication** - Implement login/signup
3. **Connect Real AI** - Replace mock with OpenAI API
4. **Deploy** - Follow DEPLOYMENT.md
5. **Add Team Features** - User management
6. **Setup Monitoring** - Error tracking & analytics

## Documentation

- **BACKEND_SETUP.md** - Backend installation
- **BACKEND_COMPLETE.md** - Full backend reference
- **API_SPECIFICATION.md** - API documentation
- **DEPLOYMENT.md** - Production deployment
- **IMPLEMENTATION_SUMMARY.md** - Frontend overview
- **CMS_OVERVIEW.md** - System overview

## Support

Built with:
- Next.js 16
- Express.js
- Mongoose/MongoDB
- TypeScript
- React Hook Form
- Tailwind CSS

See respective docs for detailed help.

## Happy Building!

You now have a production-ready CMS system. Start creating content! 🚀
