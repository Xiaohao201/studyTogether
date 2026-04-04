# StudyTogether - Architecture Overview

> **Last Updated**: 2026-01-26
> **Project Status**: Early Development (MVP Phase)

## System Overview

StudyTogether is a real-time global learning companion platform that connects students worldwide based on their learning activities and geographic location.

### Core Value Proposition
- **Global Learning Map**: Real-time visualization of active learners worldwide
- **Nearby Matching**: Location-based discovery of study partners
- **Privacy-First**: Fuzzy location display with granular privacy controls
- **Real-Time Communication**: WebSocket-based live updates

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                          │
│                   Next.js 14 (App Router)                       │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐      │
│  │ React Pages   │  │ Mapbox GL     │  │ Socket.io     │      │
│  │ (RSC/SSR)     │  │ Integration   │  │ Client        │      │
│  └───────────────┘  └───────────────┘  └───────────────┘      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/HTTPS + WebSocket
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      Backend API Layer                          │
│                     FastAPI (Python 3.11+)                      │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐      │
│  │ REST API      │  │ Socket.io     │  │ GeoAlchemy2   │      │
│  │ Endpoints     │  │ Server        │  │ (PostGIS)     │      │
│  └───────────────┘  └───────────────┘  └───────────────┘      │
│  ┌───────────────┐  ┌───────────────┐                         │
│  │ JWT Auth      │  │ Pydantic      │                         │
│  │ (python-jose) │  │ Validation    │                         │
│  └───────────────┘  └───────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ SQLAlchemy ORM
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                 │
│              PostgreSQL 15 + PostGIS Extension                  │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐      │
│  │ Users         │  │ User          │  │ Study         │      │
│  │ (Auth)        │  │ Locations     │  │ Sessions      │      │
│  │               │  │ (Geospatial)  │  │               │      │
│  └───────────────┘  └───────────────┘  └───────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Next.js** | 14.2.15 | React framework with App Router |
| **React** | 18.3.1 | UI library |
| **TypeScript** | 5.x | Type safety |
| **Tailwind CSS** | 3.4.1 | Utility-first styling |
| **Mapbox GL** | 3.9.2 | Interactive maps |
| **Socket.io Client** | 4.8.1 | Real-time communication |
| **Zustand** | 4.5.5 | State management |
| **Zod** | 3.23.8 | Schema validation |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| **FastAPI** | 0.115.6 | Async web framework |
| **Python** | 3.11+ | Runtime |
| **Socket.io** | 5.11.4 | WebSocket server |
| **SQLAlchemy** | 2.0.36 | ORM |
| **Pydantic** | 2.10.4 | Data validation |
| **PostgreSQL** | 15 | Relational database |
| **PostGIS** | 3.3 | Geospatial extension |

### DevOps
| Technology | Purpose |
|-----------|---------|
| **Docker Compose** | Local development orchestration |
| **Alembic** | Database migrations |
| **pytest** | Testing framework |
| **uvicorn** | ASGI server |

---

## Key Design Patterns

### 1. Real-Time Location Updates
```typescript
// Frontend emits location updates
socket.emit('location-update', {
  latitude: number,
  longitude: number,
  subject: string,
  status: 'studying' | 'break' | 'offline'
})
```

### 2. Privacy Architecture
```typescript
// Three-tier privacy system
enum PrivacyMode {
  Exact = 'EXACT',           // Friends only
  Fuzzy = 'FUZZY',           // ~1km accuracy (public)
  Invisible = 'INVISIBLE'    // Hidden from all
}
```

### 3. API Response Format
```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
```

---

## Data Flow

### Authentication Flow
1. User submits credentials → `/api/auth/login`
2. Backend validates against database
3. Returns JWT access token (15min) + refresh token (7 days)
4. Frontend stores tokens, includes in Authorization header
5. Protected routes verify JWT signature

### Real-Time Location Flow
1. Client browser gets GPS coordinates
2. Client emits `location-update` via Socket.io
3. Backend validates and stores in database
4. Backend calculates nearby users (PostGIS ST_DistanceSphere)
5. Server emits `nearby-users` to affected clients
6. Client updates map markers

### Nearby Matching Flow
1. Client requests `/api/users/nearby?lat=X&lng=Y&radius=5000`
2. Backend queries PostGIS for users within radius
3. Filters by privacy mode (fuzzy vs exact)
4. Returns sorted list with distance metadata
5. Client displays on map with proximity indicators

---

## Security Considerations

### Implemented
- ✅ JWT-based authentication
- ✅ CORS configuration
- ✅ Password hashing with bcrypt
- ✅ Environment-based configuration

### Planned (from research.md)
- ⏳ Fuzzy location by default (privacy-first)
- ⏳ Automatic data cleanup after 30 days
- ⏳ GDPR compliance (export/delete)
- ⏳ Rate limiting on API endpoints
- ⏳ Input validation with Zod/Pydantic

---

## Development Status

### Completed (as of 2026-01-26)
- ✅ Project scaffolding (frontend + backend)
- ✅ Docker Compose environment
- ✅ Type definitions (TypeScript)
- ✅ Basic UI components (shadcn/ui)
- ✅ Landing page

### In Progress
- 🔄 Backend API structure (to be implemented)
- 🔄 Database models (to be implemented)
- 🔄 Authentication system (to be implemented)
- 📍 Map integration (to be implemented)
- 📍 Real-time WebSocket (to be implemented)

---

## Deployment Architecture (Planned)

```
┌─────────────────────────────────────────────────────┐
│              Production Environment                  │
│                                                     │
│  ┌─────────────┐      ┌─────────────┐              │
│  │   Frontend  │      │   Backend   │              │
│  │   (Vercel)  │◄────►│  (Railway)  │              │
│  └─────────────┘      └─────────────┘              │
│         │                     │                      │
│         │                     │                      │
│         └─────────────────────┼──────────────────────┘
│                               │
│                    ┌──────────▼──────────┐
│                    │  Managed PostgreSQL │
│                    │   (Neon/Supabase)   │
│                    └─────────────────────┘
└─────────────────────────────────────────────────────┘
```

---

## References

- **Research Document**: `/research.md` - Comprehensive feasibility study
- **Frontend Types**: `/frontend/types/index.ts` - TypeScript definitions
- **Backend Config**: `/backend/pyproject.toml` - Python dependencies
- **Docker Setup**: `/docker-compose.yml` - Local development stack

---

**Next Steps**:
1. Implement backend API structure
2. Set up database models with Alembic migrations
3. Create authentication endpoints
4. Integrate Mapbox in frontend
5. Implement Socket.io real-time features
