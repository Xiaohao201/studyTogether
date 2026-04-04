# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**StudyTogether** is a real-time global learning companion platform that connects students worldwide based on their learning activities and geographic location.

**Tech Stack:**
- **Frontend**: Next.js 14 (App Router) + TypeScript 5 + Tailwind CSS + Mapbox GL
- **Backend**: FastAPI (Python 3.11+) + Socket.io + SQLAlchemy 2.0
- **Database**: PostgreSQL 15 + PostGIS 3.3 (geospatial queries)
- **DevOps**: Docker Compose for local development

**Key Features:**
- Real-time location updates via WebSocket
- Privacy-first design (fuzzy location ~1km accuracy by default)
- Nearby user matching using PostGIS spatial queries
- JWT authentication with access/refresh tokens

---

## Development Commands

### Environment Setup

```bash
# Start all services (PostgreSQL + Backend)
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f backend
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev

# Type checking
npm run type-check

# Build for production
npm run build

# Start production server
npm run start

# Lint code
npm run lint
```

### Backend Development

```bash
cd backend

# Install dependencies (using pip)
pip install -r requirements.txt

# Run development server (http://localhost:8000)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Run tests
pytest

# Run specific test file
pytest tests/test_auth.py

# Run tests with coverage
pytest --cov=app tests/

# Create database migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

### Database Operations

```bash
# Connect to PostgreSQL
docker exec -it studytogether-db psql -U studytogether -d studytogether

# Enable PostGIS extension (run once)
CREATE EXTENSION IF NOT EXISTS postgis;

# Verify PostGIS is installed
SELECT PostGIS_Version();
```

---

## Architecture

### High-Level Data Flow

```
Frontend (Next.js) ←→ Backend (FastAPI) ←→ PostgreSQL + PostGIS
     ↓                           ↓
Socket.io Client        Socket.io Server + SQLAlchemy ORM
```

**Real-Time Flow:**
1. Client browser obtains GPS coordinates
2. Client emits `location-update` via Socket.io
3. Backend validates and stores in database (with fuzzy location)
4. Backend queries nearby users using PostGIS `ST_DWithin()`
5. Server emits `nearby-users` to affected clients
6. Client updates map markers

### Key Architectural Patterns

**1. Privacy Tiers**
```typescript
// Privacy modes control location visibility
enum PrivacyMode {
  Exact = 'EXACT',           // Friends only (precise location)
  Fuzzy = 'FUZZY',           // Public (~1km accuracy with jitter)
  Invisible = 'INVISIBLE'    // Hidden from everyone
}
```

**2. Type System**
- **Frontend**: Centralized types in `frontend/types/index.ts` (126 lines)
- **Backend**: Pydantic schemas in `backend/app/schemas/` (planned)
- **Shared**: Both use similar structure for API contracts

**3. API Response Format**
```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
```

**4. Geospatial Queries**
- Database stores both `coordinates` (exact, private) and `fuzzy_coordinates` (public)
- PostGIS `GEOGRAPHY(POINT, 4326)` type for WGS84 coordinates
- GiST index on `fuzzy_coordinates` for fast proximity queries
- Distance calculated via `ST_DistanceSphere()` (returns meters)

### Project Structure

```
/
├── frontend/                 # Next.js 14 application
│   ├── app/                 # App Router pages
│   ├── components/          # React components (shadcn/ui)
│   ├── lib/                 # Utilities (cn helper, API client)
│   ├── types/               # TypeScript definitions
│   └── package.json
│
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── main.py          # FastAPI entry point
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── api/             # API route handlers
│   │   ├── services/        # Business logic
│   │   └── socket/          # Socket.io event handlers
│   ├── tests/               # pytest suite
│   ├── alembic/             # Database migrations
│   └── requirements.txt
│
├── codemaps/                # Architecture documentation
│   ├── architecture.md      # System overview
│   ├── frontend.md          # Frontend structure
│   ├── backend.md           # Backend structure
│   └── data.md              # Database schema
│
├── docker-compose.yml       # Dev environment orchestration
└── research.md              # Feasibility study (562 lines)
```

---

## Critical Implementation Details

### Database Schema

**Three Core Tables:**

1. **`users`** - Authentication, profile, privacy settings
   - `id` (UUID, PK), `username`, `email`, `hashed_password`
   - `status` ENUM: 'studying' | 'break' | 'offline'
   - `privacy_mode` ENUM: 'exact' | 'fuzzy' | 'invisible'
   - `study_duration_minutes` (total accumulated time)

2. **`user_locations`** - Location history with PostGIS
   - `coordinates` GEOGRAPHY(POINT) - exact location (private)
   - `fuzzy_coordinates` GEOGRAPHY(POINT) - jittered location (public)
   - `city`, `district` - geocoded results (cached)
   - **Retention**: 30-day auto-cleanup (GDPR compliance)

3. **`study_sessions`** - Study session tracking
   - `subject`, `started_at`, `ended_at`, `duration_minutes`
   - `participants_count` - for future group sessions

**Indexes:**
- B-tree on `users.email`, `users.username`, `users.status`
- GiST on `user_locations.fuzzy_coordinates` (critical for nearby queries)

### Location Fuzzying Algorithm

```python
# Backend service: generate_fuzzy_location()
# Add random jitter (~500m radius) to coordinates
lat_offset = random.uniform(-0.005, 0.005)  # ~500m
lng_offset = random.uniform(-0.005, 0.005)
return (lat + lat_offset, lng + lng_offset)
```

### Nearby Users Query Pattern

```sql
-- Use ST_DWithin (index-aware) instead of ST_DistanceSphere
SELECT u.*, ul.city,
       ST_DistanceSphere(
         ul.fuzzy_coordinates,
         ST_MakePoint(:lng, :lat)::geography
       ) as distance_meters
FROM users u
JOIN user_locations ul ON u.id = ul.user_id
WHERE u.privacy_mode IN ('fuzzy', 'exact')
  AND ST_DWithin(
    ul.fuzzy_coordinates::geography,
    ST_MakePoint(:lng, :lat)::geography,
    :radius_meters  -- e.g., 5000 meters
  )
ORDER BY distance_meters ASC
LIMIT 20;
```

### Authentication Flow

1. User submits credentials to `POST /api/auth/login`
2. Backend validates using `passlib` bcrypt
3. Returns JWT access token (15min expiry) + refresh token (7 days)
4. Frontend stores tokens, includes in `Authorization: Bearer <token>` header
5. Protected routes use `get_current_user` dependency to verify JWT

**JWT Configuration (backend):**
```python
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7
```

---

## Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL=postgresql://studytogether:password@localhost:5432/studytogether
POSTGRES_USER=studytogether
POSTGRES_PASSWORD=studytogether_dev_password
POSTGRES_DB=studytogether

# JWT (CHANGE IN PRODUCTION)
SECRET_KEY=your-super-secret-key-change-this-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# Frontend URLs
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_public_token
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000

# Environment
ENVIRONMENT=development
```

**Important:** Never commit `.env` file (already in `.gitignore`).

---

## TypeScript Path Aliases

Frontend uses path aliases defined in `tsconfig.json`:

```typescript
import { Button } from "@/components/ui/button"
import { User } from "@/types"
import { cn } from "@/lib/utils"
```

Resolved paths:
- `@/*` → `./`
- `@/components/*` → `./components/*`
- `@/lib/*` → `./lib/*`
- `@/types/*` → `./types/*`

---

## Testing Strategy

**Backend (pytest):**
- Unit tests for services, utilities
- Integration tests for API endpoints
- Async test support via `pytest-asyncio`
- Test fixtures in `tests/conftest.py`

**Frontend (planned):**
- Component tests with React Testing Library
- E2E tests with Playwright
- Type checking via `npm run type-check`

**Coverage Goal:** 80%+ (enforced by TDD workflow agent)

---

## Code Style Guidelines

**Python Backend:**
- Line length: 100 characters (Black config)
- Use `isort` for import sorting
- Type hints required for all functions
- Pydantic models for validation

**TypeScript Frontend:**
- Strict mode enabled
- No `any` types (use proper types from `@/types`)
- Use `cn()` utility for conditional classes
- Prefer function components with hooks

---

## Common Pitfalls

**1. PostGIS Coordinates Order**
- ❌ Wrong: `ST_MakePoint(lat, lng)`
- ✅ Correct: `ST_MakePoint(lng, lat)` - longitude FIRST

**2. Privacy Mode Filtering**
- Always filter by `privacy_mode` when querying nearby users
- Never expose exact location unless user is friend AND `show_exact_to_friends=true`

**3. JWT Token Expiry**
- Access tokens expire in 15 minutes
- Frontend must implement refresh token logic
- Use `axios` interceptors for automatic token refresh

**4. Database Connection**
- Use async SQLAlchemy sessions: `AsyncSession`
- Always commit or rollback transactions
- Use `depends(get_db)` for route dependencies

**5. Socket.io Event Naming**
- Client → Server: `location-update`, `status-update`
- Server → Client: `nearby-users`, `user-entered`, `user-left`
- Use kebab-case for consistency

---

## Deployment Considerations

**Current:** Docker Compose for local development
**Planned Production:**
- Frontend: Vercel (Next.js optimized)
- Backend: Railway/Fly.io (FastAPI support)
- Database: Neon Postgres (managed, with PostGIS)
- Real-time: May switch to Pusher if Socket.io scaling issues arise

---

## Key Dependencies

**Frontend:**
- `next` (14.2.15) - React framework with App Router
- `socket.io-client` (4.8.1) - WebSocket client
- `mapbox-gl` (3.9.2) - Interactive maps
- `zustand` (4.5.5) - State management (planned use)
- `zod` (3.23.8) - Schema validation
- `@radix-ui/*` - Accessible UI primitives (shadcn/ui)

**Backend:**
- `fastapi` (0.115.6) - Async web framework
- `python-socketio` (5.11.4) - WebSocket server
- `sqlalchemy` (2.0.36) - Async ORM
- `geoalchemy2` (0.15.2) - PostGIS integration
- `pydantic` (2.10.4) - Data validation
- `python-jose` (3.3.0) - JWT handling
- `passlib` (1.7.4) - Password hashing (bcrypt)

---

## Documentation

- **Architecture Overview**: `codemaps/architecture.md`
- **Frontend Structure**: `codemaps/frontend.md`
- **Backend Structure**: `codemaps/backend.md`
- **Database Schema**: `codemaps/data.md`
- **Research Report**: `research.md` (market analysis, feasibility study)

---

## GDPR Compliance

**Data Minimization:**
- Only store location data for 30 days
- Automatic cleanup via cron job or Python APScheduler

**User Rights:**
- Right to erasure: `DELETE FROM users WHERE id = :user_id`
- Right to export: SQL query to aggregate all user data
- Right to rectification: Update via `PUT /api/users/me`

**Default Privacy:**
- Fuzzy location by default (~1km accuracy)
- Users must explicitly opt-in to exact location sharing
