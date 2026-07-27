# Backend Setup Guide

## Overview

Production-ready Node.js/Express backend for the CMS system with MongoDB, featuring:
- 22 complete Mongoose schemas with validation
- JWT-based authentication
- AI service integration (OpenAI with mock fallback)
- Scheduled jobs for automation
- Global error handling
- CORS and security middleware

## Prerequisites

- Node.js 18+ and pnpm
- MongoDB instance (local or Atlas)
- OpenAI API key (optional for AI features)

## Installation

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/cms-production
PORT=5000
JWT_SECRET=your-secret-key-change-in-production
AI_PROVIDER=mock  # or 'openai'
AI_API_KEY=sk-your-api-key
FRONTEND_URL=http://localhost:3000
```

## Running the Backend

### Development Mode
```bash
npm run server:dev
```

### Seed Database
```bash
npm run seed
```

Creates test user (test@example.com / password123) with sample data.

### Full Stack (Frontend + Backend)
```bash
npm run dev:full
```

## Database Models (22 Total)

### Research & Strategy
- BrandVoice - Brand guidelines and messaging
- Persona - Target audience personas
- Trend - Market trends tracking
- Competitor - Competitor intelligence
- Compliance - Legal and platform rules
- StoreInfo - Store information and promotions
- Keywords - SEO and hashtag keywords

### Content Creation
- ProductBrief - Product information
- Idea - Content ideas with status
- Script - Video scripts (draft/approved/rejected)
- Storyboard - Scene breakdowns
- AudioGuide - Voice acting guidance

### Optimization
- VideoMetadata - SEO metadata
- ThumbnailBrief - Thumbnail design briefs

### Analytics
- VideoKPI - Performance metrics with auto-ranking
- WinLossAnalysis - Performance analysis reports
- Lesson - Lessons learned from analytics

### Archive
- ArchiveItem - Archived items with restoration

### User Management
- User - User accounts with roles

## API Endpoints

### Ideas (Complete Example)
```
GET    /api/ideas                    # List all ideas
GET    /api/ideas/:id                # Get specific idea
POST   /api/ideas                    # Create idea
PUT    /api/ideas/:id                # Update idea
DELETE /api/ideas/:id                # Delete idea
POST   /api/ideas/generate           # Generate from product
POST   /api/ideas/bulk-update        # Bulk status update
```

All endpoints require JWT token in Authorization header:
```
Authorization: Bearer <token>
```

## Architecture

```
server/
├── config/          # Database & app config
├── models/          # 22 Mongoose schemas
├── controllers/     # Route handlers
├── routes/          # API route definitions
├── middleware/      # Auth, error handling
├── services/        # Business logic (AI)
├── seeds/           # Database seeding
└── index.ts         # Main server entry
```

## Features

### Authentication
- JWT-based with automatic token validation
- Role-based access control (admin, editor, viewer)
- Password hashing with bcryptjs

### AI Integration
- Configurable provider (mock/OpenAI)
- Generates: ideas, scripts, metadata, thumbnails, analysis
- Fallback to mock responses if API fails

### Auto-Ranking
- KPIs automatically ranked S-D based on views/likes
- Accessible via analytics dashboard

### Scheduled Jobs
- Auto-archive products after 90 days
- Auto-rank computation (configurable)

## Deployment

### MongoDB Atlas
1. Create free cluster at mongodb.com/cloud/atlas
2. Get connection string
3. Set MONGODB_URI in .env

### Vercel
1. Create server app from `server/` directory
2. Add environment variables
3. Deploy

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN pnpm install
EXPOSE 5000
CMD ["npm", "run", "server:dev"]
```

## Testing

Seed database with test data:
```bash
npm run seed
```

Then test endpoints with curl or Postman:
```bash
curl -H "Authorization: Bearer <token>" http://localhost:5000/api/ideas
```

## Error Handling

All errors return consistent format:
```json
{
  "error": "Error message",
  "statusCode": 400
}
```

## Security Checklist

- [x] JWT tokens required
- [x] Password hashing
- [x] CORS configured
- [x] Input validation
- [x] SQL injection prevention (Mongoose)
- [ ] Rate limiting (recommended)
- [ ] HTTPS in production (required)
- [ ] Environment variables not in code

## Next Steps

1. Add more controllers for remaining models
2. Implement rate limiting middleware
3. Add request validation with Joi or Zod
4. Set up automated tests
5. Configure CI/CD pipeline
