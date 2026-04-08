# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**StudyTogether** — real-time global learning companion platform. Connects students by learning activity and geographic location, with voice/video calling via WebRTC.

**Tech Stack:**
- **Frontend**: Next.js 14 (App Router) + TypeScript 5 + Tailwind CSS + AMap (高德地图) + Zustand
- **Backend**: FastAPI (Python 3.11+) + Socket.io + SQLAlchemy 2.0 (async)
- **Database**: PostgreSQL 15 + PostGIS 3.3 (optional — decimal coordinate fallback for Railway)
- **Real-time**: Socket.io for signaling + WebRTC for voice/video calls
- **DevOps**: Docker Compose (PostgreSQL + coturn TURN server; backend runs locally)

---

## Development Commands

### Environment Setup

```bash
# Start PostgreSQL + TURN server (backend runs locally, not containerized)
docker-compose up -d

# Stop services
docker-compose down
```

### Frontend

```bash
cd frontend
npm install
npm run dev              # http://localhost:3000
npm run build            # Production build
npm run type-check       # tsc --noEmit
npm run lint             # ESLint
npm run test             # Playwright E2E tests
npm run test:headed      # Playwright with browser UI
npm run test:debug       # Playwright debug mode
```

### Backend

```bash
cd backend
pip install -r requirements.txt

# IMPORTANT: Use socket_app, not app — Socket.io won't work otherwise
uvicorn app.main:socket_app --host 0.0.0.0 --port 8000 --reload

pytest                                    # All tests
pytest tests/test_auth.py                 # Single file
pytest --cov=app tests/                   # With coverage
alembic revision --autogenerate -m "desc" # Create migration
alembic upgrade head                      # Apply migrations
```

### Database

```bash
docker exec -it studytogether-db psql -U studytogether -d studytogether
```

---

## Architecture

### Data Flow

```
Browser (AMap + GPS) ──→ Socket.io ──→ FastAPI ──→ PostgreSQL
                            ↓
                     WebRTC signaling (call offer/answer/ICE)
                            ↓
                  Browser ←──P2P──→ Browser (voice/video)
```

**Real-time location flow:**
1. Client gets GPS → emits `location-update` via Socket.io
2. Backend validates, stores with fuzzy jitter, queries nearby users (Haversine or PostGIS)
3. Server emits `nearby-users` → client updates map markers

**WebRTC call flow:**
1. Caller creates room via REST (`POST /api/calls/start`)
2. Caller creates RTCPeerConnection, SDP offer → sends via Socket.io `call_offer`
3. Callee receives `incoming-call-offer`, creates answer → `call_answer`
4. Both exchange ICE candidates via Socket.io
5. P2P connection established; TURN server (coturn) for NAT traversal

### Key Architectural Patterns

**Privacy tiers** — `privacy_mode` controls location visibility:
- `exact` — friends only (precise location)
- `fuzzy` — public (~500m jitter added to coordinates)
- `invisible` — hidden from everyone

**Coordinates** — location model stores both exact (`latitude`/`longitude`) and fuzzy (`fuzzy_latitude`/`fuzzy_longitude`) as `Numeric(10,8)` / `Numeric(11,8)`. PostGIS `GEOGRAPHY(POINT)` is optional — the service layer uses Haversine as fallback when PostGIS is unavailable (e.g., Railway PostgreSQL).

**State management** — Zustand stores in `frontend/store/`:
- `authStore` — JWT tokens, user profile (persisted to localStorage)
- `locationStore` — GPS tracking, nearby users
- `sessionStore` — active study session
- `callStore` — WebRTC peer connection, media streams, call signaling

**API response format:**
```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
```

### Backend Module Layout

```
backend/app/
├── main.py              # FastAPI app + Socket.io ASGI mount + CORS
├── dependencies.py      # get_current_user, get_db FastAPI dependencies
├── core/
│   ├── config.py        # Pydantic Settings (env vars)
│   ├── database.py      # AsyncSession engine
│   └── security.py      # JWT create/verify
├── models/              # SQLAlchemy ORM: user, location, session, call
├── schemas/             # Pydantic request/response: auth, user, location, session, call
├── api/                 # Route handlers: auth, users, locations, sessions, calls
├── services/            # Business logic: auth, location (Haversine), session, call
└── socket/
    ├── __init__.py      # Socket.io server + auth middleware + connected_users dict
    └── call_handler.py  # WebRTC signaling event handlers
```

### Frontend Layout

```
frontend/
├── app/
│   ├── map/page.tsx            # Main map view (AMap + nearby users)
│   └── call/[roomCode]/page.tsx # Active call room (WebRTC video/audio)
├── components/
│   ├── call/                   # CallButton, CallControls, IncomingCallDialog
│   ├── StudyMap.tsx            # AMap integration
│   └── ui/                     # shadcn/ui (button, dialog, etc.)
├── lib/
│   ├── api.ts                  # Axios client with JWT interceptor + refresh
│   ├── callSocket.ts           # Socket.io client for call signaling
│   ├── webrtc.ts               # WebRTC peer connection manager
│   └── storage.ts              # LocalStorage utilities
├── store/                      # Zustand stores (auth, location, session, call)
└── types/index.ts              # All TypeScript type definitions
```

---

## Database Schema

**`users`** — `id` (UUID PK), `username`, `email`, `hashed_password`, `subject`, `status` (studying/break/offline), `privacy_mode` (exact/fuzzy/invisible), `study_duration_minutes`, `show_exact_to_friends`, timestamps

**`user_locations`** — `id` (UUID PK), `user_id` (FK), `latitude`/`longitude` (exact, private), `fuzzy_latitude`/`fuzzy_longitude` (public, ~500m jitter), `city`, `district`, `country_code`, `created_at`. 30-day retention (GDPR).

**`study_sessions`** — `id` (UUID PK), `user_id` (FK), `subject`, `started_at`, `ended_at`, `duration_minutes`, `participants_count`

**`call_rooms`** — `id` (UUID PK), `room_code` (unique), `host_id` (FK), `call_type` (voice/video), `call_status` (initiated/ongoing/ended/rejected), `study_session_id` (FK nullable), `duration_seconds`

**`call_participants`** — `id` (UUID PK), `call_room_id` (FK), `user_id` (FK), `joined_at`, `left_at`, `has_video`, `has_audio`

---

## API Endpoints

| Prefix | Router | Key Routes |
|--------|--------|------------|
| `/api/auth` | auth.py | POST `/register`, `/login`; GET/PUT `/me` |
| `/api/users` | users.py | GET `/me`, `/nearby` |
| `/api/locations` | locations.py | POST `/`, GET `/me`, `/nearby`, `/stats`; DELETE `/` |
| `/api/sessions` | sessions.py | POST `/`, PUT `/{id}/end`, GET `/{id}`, `/active` |
| `/api/calls` | calls.py | POST `/start`, `/end`; GET `/{roomCode}`, `/active/my-calls` |

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql+asyncpg://studytogether:password@localhost:5432/studytogether

# JWT
SECRET_KEY=your-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# Frontend (set in frontend/.env.local)
NEXT_PUBLIC_AMAP_KEY=your_amap_key
NEXT_PUBLIC_AMAP_SECRET=your_amap_secret
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000

# WebRTC TURN server
TURN_SERVER_URL=turn:localhost:3478
TURN_USERNAME=studytogether
TURN_PASSWORD=turn-dev-password
```

---

## Common Pitfalls

1. **Uvicorn target must be `socket_app`** — `uvicorn app.main:socket_app` (not `app.main:app`). The `socket_app` wraps the FastAPI app with Socket.io ASGI + CORS. Using `app` directly means Socket.io won't work.

2. **PostGIS coordinates order** — `ST_MakePoint(lng, lat)` — longitude first. This is a consistent source of bugs.

3. **Privacy mode filtering** — always filter by `privacy_mode` when querying nearby users. Never expose exact coordinates unless `show_exact_to_friends=true` AND the viewer is a friend.

4. **CORS double-wrap** — CORS is applied both on the FastAPI `app` (for REST) and on the outer `socket_app` (for Socket.io). Changes to CORS must update both in `main.py`.

5. **Location model uses decimal columns** — not PostGIS geometry. The `coordinates`/`fuzzy_coordinates` GEOGRAPHY columns referenced in older docs have been replaced with `latitude`/`longitude`/`fuzzy_latitude`/`fuzzy_longitude` Numeric columns. The Haversine formula is used for distance calculations as a PostGIS fallback.

6. **Socket.io event naming** — kebab-case: `call_offer`, `call_answer`, `ice_candidate`, `incoming-call-offer`, `call-answered`, `call-ended`.

---

## TypeScript Path Aliases

```typescript
import { Button } from "@/components/ui/button"   // ./components/ui/button
import { useAuthStore } from "@/store/authStore"    // ./store/authStore
import { User } from "@/types"                      // ./types/index.ts
import { cn } from "@/lib/utils"                    // ./lib/utils.ts
```

---

## Testing

**Backend (pytest):** `tests/conftest.py` provides async test fixtures. Tests use `pytest-asyncio`.

**Frontend (Playwright):** E2E tests in `frontend/tests/e2e/` using Page Object Model. Configured for Chromium, single worker.

```bash
# Frontend E2E (first time)
cd frontend && npm run test:install   # Install Playwright browsers
npm run test                          # Run tests
```
