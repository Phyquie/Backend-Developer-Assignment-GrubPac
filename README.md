# Content Broadcasting System — Backend API

A production-ready REST API that enables teachers to upload subject-based content, principals to review and approve it, and students to access the currently live content through a public broadcasting endpoint powered by a stateless time-based rotation algorithm.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Scheduling Logic](#scheduling-logic)
- [Content Lifecycle](#content-lifecycle)
- [Edge Cases](#edge-cases)
- [Bonus Features](#bonus-features)
- [Project Structure](#project-structure)
- [Assumptions](#assumptions)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 18+ |
| Framework | Express 4 |
| Database | PostgreSQL (Supabase) |
| ORM | Sequelize 6 |
| Authentication | JWT + bcrypt |
| File Upload | Multer 2 (disk / S3) |
| Caching | Redis (ioredis) |
| Validation | express-validator |
| Rate Limiting | express-rate-limit |
| Logging | Winston |
| Security | Helmet, CORS |

---

## Features

### Core
- JWT authentication with role-based access control (Principal / Teacher)
- Content upload system — JPG, PNG, GIF, max 10 MB
- Full content lifecycle state machine: `uploaded` → `pending` → `approved` / `rejected`
- Principal approval workflow with mandatory rejection reasons
- Public broadcasting API with deterministic time-based rotation scheduling
- Per-subject independent rotation queues per teacher
- All required edge cases handled

### Bonus
- Redis caching on `/content/live` with smart TTL + automatic cache invalidation on approval
- Three-tier rate limiting (auth / broadcast / global)
- S3 upload support (auto-activates when AWS env vars are set)
- Subject-wise analytics endpoint
- Pagination and filters on all list endpoints

---

## Prerequisites

- Node.js >= 18
- PostgreSQL 13+ **or** a Supabase project
- Redis **or** a Redis Cloud / Upstash instance (optional — caching disabled if absent)
- npm

---

## Setup & Installation

### 1. Clone the repository

```bash
git clone https://github.com/Phyquie/Backend-Developer-Assignment-GrubPac.git
cd Backend-Developer-Assignment-GrubPac
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials. Minimum required:

```env
DATABASE_URL=postgresql://postgres:PASSWORD@host:5432/postgres
JWT_SECRET=your-long-random-secret
```

See [Environment Variables](#environment-variables) for the full reference.

### 4. Seed the database

Creates the principal and two demo teacher accounts. Tables are auto-created on first run.

```bash
npm run seed
```

| Role | Email | Password |
|------|-------|----------|
| Principal | principal@school.com | Principal@123 |
| Teacher 1 | teacher1@school.com | Teacher@123 |
| Teacher 2 | teacher2@school.com | Teacher@123 |

### 5. Start the server

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

Server runs at `http://localhost:3000`  
API base: `http://localhost:3000/api/v1`

---

## Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# Database — Option A: connection URL (Supabase / Railway / Heroku)
DATABASE_URL=postgresql://postgres:[PASSWORD]@host:5432/postgres

# Database — Option B: individual params (local PostgreSQL)
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=content_broadcasting
# DB_USER=postgres
# DB_PASSWORD=your_password

# JWT
JWT_SECRET=your-very-long-random-secret
JWT_EXPIRES_IN=7d

# File Upload
MAX_FILE_SIZE=10485760        # 10 MB in bytes
UPLOAD_DEST=uploads/

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000   # 15 minutes
RATE_LIMIT_MAX=100

# Redis Caching — Option A: URL
# REDIS_URL=redis://localhost:6379

# Redis Caching — Option B: individual params (Redis Cloud)
# REDIS_HOST=redis-xxxxx.c14.us-east-1-3.ec2.cloud.redislabs.com
# REDIS_PORT=13467
# REDIS_USERNAME=default
# REDIS_PASSWORD=your_redis_password

# S3 Upload (optional — falls back to local disk if absent)
# AWS_ACCESS_KEY_ID=your_access_key
# AWS_SECRET_ACCESS_KEY=your_secret_key
# AWS_REGION=ap-south-1
# AWS_BUCKET_NAME=your-bucket-name

# Seed script defaults
PRINCIPAL_NAME=Principal Admin
PRINCIPAL_EMAIL=principal@school.com
PRINCIPAL_PASSWORD=Principal@123
```

---

## API Reference

Base URL: `http://localhost:3000/api/v1`

Protected endpoints require:
```
Authorization: Bearer <jwt_token>
```

---

### Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | None | Server health check |

---

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | None | Register a new teacher |
| POST | `/auth/login` | None | Login — returns JWT token |
| GET | `/auth/me` | Any | Get current user profile |

**Register**
```json
POST /auth/register
{
  "name": "John Doe",
  "email": "john@school.com",
  "password": "Teacher@123"
}
```

**Login**
```json
POST /auth/login
{
  "email": "principal@school.com",
  "password": "Principal@123"
}
```
Response includes `{ token, user }`.

---

### Content — Teacher

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/content` | Teacher | Upload content with file |
| PUT | `/content/:id/submit` | Teacher | Submit for principal review |
| GET | `/content/my` | Teacher | List own content |
| GET | `/content/:id` | Teacher | Get single content item |
| DELETE | `/content/:id` | Teacher | Delete non-approved content |

**Upload Content** — `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | JPG / PNG / GIF, max 10 MB |
| `title` | String | Yes | Content title |
| `subject` | String | Yes | e.g. `maths`, `science` |
| `description` | String | No | Optional description |
| `start_time` | ISO 8601 | No* | When content becomes visible |
| `end_time` | ISO 8601 | No* | When content stops being visible |
| `rotation_duration` | Integer | No | Minutes per rotation slot (default: 5) |

> `start_time` and `end_time` must be provided together or both omitted.
> Content without a time window is **never** shown in the broadcast.

**Get My Content** — query params: `status`, `subject`, `page`, `limit`

---

### Approval — Principal

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/content/all` | Principal | All content with filters |
| GET | `/content/pending` | Principal | Pending content only |
| GET | `/content/:id` | Principal | Single content item |
| PATCH | `/content/:id/approve` | Principal | Approve content |
| PATCH | `/content/:id/reject` | Principal | Reject with reason |

**Reject Content**
```json
PATCH /content/:id/reject
{
  "rejection_reason": "Image resolution too low for classroom display"
}
```

**Get All Content** — query params: `status`, `subject`, `teacherId`, `page`, `limit`

---

### Public Broadcasting API

> No authentication required — accessible by students.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/content/live/:teacherId` | None | Currently active content |
| GET | `/content/live/:teacherId/analytics` | None | Subject-level analytics |

**Query params:** `subject` — filter to a specific subject

**Response — content available:**
```json
{
  "success": true,
  "message": "Live content retrieved successfully",
  "data": [
    {
      "subject": "maths",
      "activeContent": {
        "id": "uuid",
        "title": "Chapter 1 — Algebra",
        "description": "Introduction to algebraic expressions",
        "subject": "maths",
        "fileUrl": "http://localhost:3000/uploads/abc123.jpg",
        "fileType": "image/jpeg",
        "startTime": "2026-04-27T08:00:00.000Z",
        "endTime": "2026-04-27T18:00:00.000Z"
      },
      "rotationInfo": {
        "totalItemsInRotation": 2,
        "currentDurationMinutes": 5
      }
    }
  ]
}
```

**Response — no content available:**
```json
{
  "success": true,
  "message": "No content available",
  "data": []
}
```

---

### Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/teachers` | None | List all teachers (public) |
| GET | `/users` | Principal | List all users |

---

## Scheduling Logic

The rotation is **stateless and deterministic** — computed from wall-clock time with no cron jobs or database writes.

```
position     = Date.now() % totalCycleMs
totalCycleMs = sum of all eligible content durations (in milliseconds)
```

**Algorithm:**

1. Fetch all `approved` content for the teacher where `start_time <= now <= end_time`
2. Group by subject
3. Sort each group by `rotation_order` ascending
4. Compute `totalCycleMs` = sum of durations
5. Compute `position` = `Date.now() % totalCycleMs`
6. Walk the sorted list — first item whose cumulative duration exceeds `position` is active

**Example — Maths (2 items, 10-minute cycle):**

```
|<----- 5 min ----->|<----- 5 min ----->| repeats
       Content A           Content B
  0 min         5 min              10 min -> back to 0
```

Every student hitting the endpoint at the same second sees the same content. The cycle loops infinitely.

---

## Content Lifecycle

```
[Teacher uploads]
       |
   uploaded          <- draft state, not visible to principal
       |
[Teacher submits]
       |
   pending           <- principal sees this in review queue
       |
  +---------+
  |         |
approved  rejected   <- rejected includes mandatory reason
  |
[shown only when within teacher-defined time window]
```

---

## Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Teacher does not exist | `404 Not Found` |
| No approved content for teacher | `200` — `"No content available"` |
| Approved but `start_time`/`end_time` not set | Content is **never** shown |
| Approved but current time is outside the window | `200` — `"No content available"` |
| Invalid / unknown subject query param | `200` — empty array, not an error |
| Approve already-approved content | `422 Unprocessable Entity` |
| Reject without providing a reason | `400 Bad Request` |
| Delete approved content | `422 Unprocessable Entity` |
| Upload with invalid file type | `415 Unsupported Media Type` |
| Upload exceeding 10 MB | `413 Payload Too Large` |

---

## Bonus Features

### Redis Caching
- The `/content/live` response is cached in Redis
- TTL = `min(rotation_duration)` across active items — cache always expires before the active item changes
- Cache is **invalidated immediately** when a principal approves or rejects content
- Falls back to direct DB query if Redis is unavailable — zero downtime

### Rate Limiting

| Scope | Limit |
|-------|-------|
| Auth endpoints (`/login`, `/register`) | 20 req / 15 min |
| Broadcast `/content/live` | 60 req / min |
| All other endpoints | 100 req / 15 min |

### S3 Upload
Set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, and `AWS_BUCKET_NAME` in `.env`.
The system automatically switches from local disk to S3 storage — no code change required.

### Subject-wise Analytics
`GET /api/v1/content/live/:teacherId/analytics` returns per-subject breakdown:
total content count, approved / pending / rejected counts, total rotation minutes.

### Pagination & Filters
All list endpoints support `page`, `limit`, `status`, `subject`, and `teacherId` query params.

---

## Project Structure

```
src/
├── config/
│   ├── config.js          # Environment config
│   ├── database.js        # Sequelize connection (URL or individual params)
│   └── redis.js           # Redis connection (optional)
├── controllers/
│   ├── authController.js
│   ├── contentController.js
│   ├── approvalController.js
│   ├── broadcastController.js
│   └── userController.js
├── middlewares/
│   ├── auth.js            # JWT verification
│   ├── rbac.js            # Role-based access control
│   ├── upload.js          # Multer (disk or S3)
│   ├── rateLimiter.js     # Three-tier rate limiting
│   ├── validate.js        # express-validator result handler
│   └── errorHandler.js    # Centralized error → JSON response
├── models/
│   ├── User.js
│   ├── Content.js
│   ├── ContentSlot.js     # One per teacher-subject pair
│   ├── ContentSchedule.js # Rotation order + duration per content
│   └── index.js           # Associations
├── routes/
│   ├── authRoutes.js
│   ├── contentRoutes.js   # Teacher + principal + public routes
│   ├── userRoutes.js
│   └── index.js
├── services/
│   ├── authService.js
│   ├── contentService.js
│   ├── approvalService.js
│   ├── schedulingService.js   # Core rotation algorithm + Redis cache
│   └── userService.js
├── utils/
│   ├── response.js        # Standardized JSON response helpers
│   ├── logger.js          # Winston logger
│   └── cache.js           # Redis wrapper (no-op if Redis absent)
├── scripts/
│   └── seed.js            # Creates default principal + 2 teachers
└── app.js                 # Express app + server bootstrap
uploads/                   # Local file storage (git-ignored)
architecture-notes.txt     # Full system design documentation
```

---

## Assumptions

1. **Principal creation** — principals are created via the seed script only. The `/auth/register` endpoint creates teachers exclusively.
2. **Time window requirement** — `start_time` and `end_time` must both be provided together. Content without a time window is intentionally inactive even after approval.
3. **Subject normalisation** — subjects are stored as lowercase (`"Maths"` and `"maths"` resolve to the same slot).
4. **Rotation reference point** — the rotation uses Unix epoch as the reference, making it globally consistent for all students.
5. **Teacher IDs** — the public `/content/live/:teacherId` endpoint uses the teacher's UUID. Use `GET /api/v1/users/teachers` to discover teacher IDs.
6. **File deletion** — deleting a content record removes the physical file from disk. S3 object deletion is handled via S3 lifecycle rules.
7. **Redis is optional** — the system operates identically without Redis; responses are just not cached.
