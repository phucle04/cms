# CMS API Specification

## Base URL
```
http://localhost:5000/api
```

## Authentication
All endpoints require JWT token:
```
Authorization: Bearer <jwt_token>
```

## Response Format
Success:
```json
{
  "data": { ... },
  "statusCode": 200
}
```

Error:
```json
{
  "error": "Error message",
  "statusCode": 400
}
```

## Endpoints

### Ideas

#### List Ideas
```
GET /ideas?status=new&priority=high&productId=<id>
```
Query parameters:
- status: new | in progress | done | discarded
- priority: low | medium | high
- productId: Filter by product

Response:
```json
[
  {
    "_id": "...",
    "title": "Content idea",
    "description": "...",
    "source": "user",
    "priority": "high",
    "status": "new",
    "productId": "...",
    "createdAt": "2024-07-21T..."
  }
]
```

#### Create Idea
```
POST /ideas
Content-Type: application/json

{
  "title": "Idea title",
  "description": "Full description",
  "source": "user|trend|competitor",
  "priority": "high|medium|low",
  "productId": "optional",
  "status": "new|in progress|done|discarded"
}
```

#### Update Idea
```
PUT /ideas/:id
Content-Type: application/json

{
  "status": "in progress",
  "priority": "medium",
  ...
}
```

#### Delete Idea
```
DELETE /ideas/:id
```

#### Generate Ideas from Product
```
POST /ideas/generate
Content-Type: application/json

{
  "productId": "<product_id>"
}
```

Response: Array of 5 generated ideas

#### Bulk Update Ideas
```
POST /ideas/bulk-update
Content-Type: application/json

{
  "ids": ["id1", "id2", "id3"],
  "status": "in progress",
  "priority": "high"
}
```

### Products

#### List Products
```
GET /products?status=active
```

#### Create Product
```
POST /products

{
  "name": "Product name",
  "category": "Electronics",
  "usp": "Unique selling proposition",
  "painPoints": "Description of pain points",
  "keywords": ["kw1", "kw2"],
  "status": "active|archived"
}
```

#### Update Product
```
PUT /products/:id
```

#### Delete Product
```
DELETE /products/:id
```

### Analytics

#### List KPIs
```
GET /kpis?rank=S&startDate=2024-07-01&endDate=2024-07-31
```

Query parameters:
- rank: S | A | B | C | D
- startDate, endDate: ISO date strings

#### Log KPI
```
POST /kpis

{
  "views": 50000,
  "likes": 1200,
  "comments": 300,
  "shares": 50,
  "retention": 65.5,
  "ctr": 2.3,
  "orders": 20,
  "revenue": 500
}
```

Response: KPI with auto-calculated rank

#### Get Top Performers
```
GET /kpis/top?limit=5&days=30
```

#### Generate Analysis
```
POST /analytics/generate

{
  "startDate": "2024-07-01",
  "endDate": "2024-07-31"
}
```

Response: WinLossAnalysis with patterns, gaps, recommendations

### Scripts

#### Create Script
```
POST /scripts

{
  "ideaId": "<idea_id>",
  "title": "Script title",
  "content": "Full script content...",
  "format": "short|long|bullet",
  "duration": 30,
  "keyMessages": ["msg1", "msg2"],
  "callToAction": "Click link in bio"
}
```

#### Generate Script (AI)
```
POST /scripts/generate

{
  "ideaId": "<idea_id>",
  "format": "short|long|bullet",
  "tone": "professional|casual|energetic"
}
```

#### Approve/Reject Script
```
PUT /scripts/:id/approve

{
  "status": "approved|rejected",
  "feedback": "Optional feedback"
}
```

### Research & Strategy

#### Trends
```
GET    /trends?status=hot
POST   /trends
PUT    /trends/:id
DELETE /trends/:id
```

#### Competitors
```
GET    /competitors
POST   /competitors
PUT    /competitors/:id
DELETE /competitors/:id
```

#### Personas
```
GET    /personas?type=main
POST   /personas
PUT    /personas/:id
DELETE /personas/:id
```

#### Brand Voice
```
GET    /brand-voice
PUT    /brand-voice

{
  "tone": "Professional yet friendly",
  "personality": ["innovative", "trustworthy"],
  "doList": ["Be authentic", "Show value"],
  "dontList": ["Use jargon", "Oversell"],
  "ctaSamples": ["Join us", "Learn more"]
}
```

#### Compliance Rules
```
GET    /compliance?ruleType=legal
POST   /compliance
PUT    /compliance/:id
DELETE /compliance/:id
```

### Archive

#### List Archived Items
```
GET /archive?itemType=product&status=archived
```

#### Archive Item
```
POST /archive

{
  "itemType": "product|trend|script|idea|report",
  "itemId": "<id>",
  "reason": "Why archiving"
}
```

#### Restore Item
```
POST /archive/:id/restore
```

## Status Codes

- 200: Success
- 201: Created
- 400: Bad request
- 401: Unauthorized
- 403: Forbidden
- 404: Not found
- 500: Server error

## Rate Limiting (Recommended)

Not yet implemented. Consider adding:
- 100 requests per minute per user
- 1000 requests per hour per user

## Pagination (Future)

Recommended format:
```
GET /ideas?page=1&limit=20
```

Response:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

## Filtering Examples

```
# Filter by status
GET /ideas?status=in%20progress

# Filter by multiple priorities
GET /ideas?priority=high&priority=medium

# Sort (future)
GET /ideas?sort=-createdAt

# Date range
GET /kpis?startDate=2024-07-01&endDate=2024-07-31
```

## Error Examples

Invalid token:
```json
{
  "error": "Invalid token",
  "statusCode": 401
}
```

Validation error:
```json
{
  "error": "Missing required fields: title, description",
  "statusCode": 400
}
```

Not found:
```json
{
  "error": "Idea not found",
  "statusCode": 404
}
```
