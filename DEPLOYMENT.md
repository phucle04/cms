# Deployment Guide

## Architecture

Full-stack CMS:
- **Frontend**: Next.js 16 on Vercel
- **Backend**: Express.js on Railway/Render/Heroku
- **Database**: MongoDB Atlas
- **Storage**: Optional - Vercel Blob for file uploads

## Step 1: Database Setup

### MongoDB Atlas (Free Tier)

1. Go to https://cloud.mongodb.com
2. Create a free cluster
3. Create database user (Settings → Security)
4. Get connection string (Connect → Drivers)
5. Save as `MONGODB_URI`

Example:
```
mongodb+srv://username:password@cluster.mongodb.net/cms-production?retryWrites=true&w=majority
```

## Step 2: Backend Deployment

### Option A: Railway (Recommended)

1. Push code to GitHub
2. Go to https://railway.app and sign in with GitHub
3. Create new project → Deploy from GitHub repo
4. Select repository and `server/index.ts` as root
5. Add environment variables:
   ```
   MONGODB_URI=<from atlas>
   JWT_SECRET=<generate: openssl rand -base64 32>
   NODE_ENV=production
   AI_PROVIDER=mock
   FRONTEND_URL=<your-vercel-url>
   PORT=5000
   ```
6. Deploy

Backend URL: `https://your-project.railway.app`

### Option B: Render

1. Go to https://render.com
2. Create new Web Service
3. Connect GitHub repository
4. Settings:
   - Build command: `pnpm install && pnpm exec tsc --project server/tsconfig.json`
   - Start command: `node server/dist/index.js`
5. Add environment variables
6. Deploy

### Option C: Vercel (Serverless)

1. Create `api/` directory at root
2. Move backend logic to API routes
3. Deploy normally

## Step 3: Frontend Deployment

### Vercel

1. Push code to GitHub
2. Go to https://vercel.com
3. Create new project → Import from GitHub
4. Configure:
   - Framework: Next.js
   - Environment variables:
     ```
     NEXT_PUBLIC_API_URL=<backend-url>
     ```
5. Deploy

Frontend URL: `https://your-project.vercel.app`

## Step 4: Connect Frontend to Backend

Update `lib/api-client.ts`:

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export const apiClient = {
  async get(endpoint: string) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    return response.json();
  },
  // ... implement other methods
};
```

## Step 5: Production Checklist

### Security
- [x] JWT_SECRET is strong and secret
- [x] MONGODB_URI is environment variable
- [x] Frontend URL matches deployed frontend
- [x] HTTPS enabled (automatic on Vercel/Railway)
- [ ] Rate limiting enabled
- [ ] CORS properly configured

### Performance
- [ ] Database indexes created
- [ ] Pagination implemented
- [ ] Caching headers set
- [ ] CDN enabled (Vercel automatic)

### Monitoring
- [ ] Error logging setup (Sentry)
- [ ] Analytics tracking
- [ ] Database monitoring

### Backup
- [ ] Automated backups enabled
- [ ] Restore procedure documented

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=https://api.example.com
```

### Backend (.env)
```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/db
PORT=5000
NODE_ENV=production
JWT_SECRET=<strong-random-string>
AI_PROVIDER=mock
AI_API_KEY=sk-your-key-if-using-openai
FRONTEND_URL=https://app.example.com
```

## Verification

### Test Backend
```bash
curl https://api.example.com/api/health
```

Should return:
```json
{"status": "OK", "timestamp": "..."}
```

### Test Database
1. Admin dashboard: MongoDB Atlas console
2. View collections and data
3. Monitor performance

### Test Frontend
1. Visit https://app.example.com
2. Navigate through modules
3. Check browser console for errors

## Post-Deployment

### Seed Production Database
```bash
NODE_ENV=production npm run seed
```

Creates test user and sample data.

### Monitor Performance
- Vercel Analytics: https://vercel.com/docs/analytics
- MongoDB Metrics: Atlas console
- Error tracking: Sentry dashboard

## Scaling

### Database
- Atlas: Upgrade from free to paid cluster
- Automatic sharding for large datasets

### Backend
- Railway: Scale dyno size
- Render: upgrade plan
- Add caching layer (Redis)

### Frontend
- Already on Vercel edge network
- Enable image optimization

## Troubleshooting

### Backend won't start
```
Check logs: Railway/Render dashboard
Verify: MONGODB_URI is correct
Verify: Node version matches (18+)
```

### Database connection timeout
```
Add IP whitelist in MongoDB Atlas
Check: Network connectivity
Verify: Connection string format
```

### Frontend can't reach backend
```
Check: NEXT_PUBLIC_API_URL in Vercel env
Check: Backend is running
Verify: CORS is configured
```

## Disaster Recovery

### Restore Database
1. MongoDB Atlas → Backup → Restore
2. Download backup data
3. Re-import to new cluster

### Rollback Code
1. Vercel: Revert deployment
2. Railway: Rollback service

## Cost Estimation (Monthly)

| Service | Cost |
|---------|------|
| MongoDB Atlas Free | $0 (shared) |
| Railway Starter | $5 |
| Vercel Hobby | $0 (with limits) |
| **Total** | **~$5** |

Upgrade for production use.

## Support

- MongoDB Atlas: https://docs.mongodb.com
- Railway: https://docs.railway.app
- Vercel: https://vercel.com/docs
- Express: https://expressjs.com
