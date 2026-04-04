# StudyTogether - Backend Code Map

> **Last Updated**: 2026-01-26
> **Framework**: FastAPI 0.115+
> **Language**: Python 3.11+
> **Status**: Project Scaffolded (Implementation Pending)

## Directory Structure (Planned)

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application entry point
│   ├── config.py            # Settings and configuration (Pydantic Settings)
│   ├── dependencies.py      # Dependency injection (auth, db session)
│   │
│   ├── api/                 # API route handlers
│   │   ├── __init__.py
│   │   ├── auth.py          # Authentication endpoints (/auth/*)
│   │   ├── users.py         # User CRUD (/users/*)
│   │   ├── locations.py     # Location updates (/locations/*)
│   │   ├── sessions.py      # Study sessions (/sessions/*)
│   │   └── nearby.py        # Nearby users query (/users/nearby)
│   │
│   ├── models/              # SQLAlchemy ORM models
│   │   ├── __init__.py
│   │   ├── user.py          # User table
│   │   ├── user_location.py # UserLocation table (with PostGIS)
│   │   └── study_session.py # StudySession table
│   │
│   ├── schemas/             # Pydantic schemas (request/response)
│   │   ├── __init__.py
│   │   ├── auth.py          # Login, Register, Token response
│   │   ├── user.py          # UserCreate, UserUpdate, UserResponse
│   │   ├── location.py      # LocationUpdate, LocationResponse
│   │   └── session.py       # SessionCreate, SessionResponse
│   │
│   ├── services/            # Business logic layer
│   │   ├── __init__.py
│   │   ├── auth_service.py  # JWT generation, password hashing
│   │   ├── location_service.py  # Location fuzzying, nearby query
│   │   └── socket_service.py    # Socket.io event handlers
│   │
│   ├── core/                # Core utilities
│   │   ├── __init__.py
│   │   ├── security.py      # JWT, password hashing utilities
│   │   ├── database.py      # Database connection setup
│   │   └── socket.py        # Socket.io server setup
│   │
│   └── socket/              # Socket.io event handlers
│       ├── __init__.py
│       └── events.py        # location-update, connect, disconnect
│
├── tests/                   # pytest test suite
│   ├── __init__.py
│   ├── conftest.py          # Test fixtures
│   ├── test_auth.py         # Auth endpoint tests
│   ├── test_locations.py    # Location API tests
│   └── test_socket.py       # WebSocket event tests
│
├── alembic/                 # Database migrations
│   ├── versions/            # Migration files
│   └── env.py               # Alembic environment
│
├── pyproject.toml           # Poetry/uv dependencies
├── requirements.txt         # pip dependencies
└── Dockerfile               # Container image

```

---

## Technology Stack

### Core Framework
| Package | Version | Purpose |
|---------|---------|---------|
| **FastAPI** | 0.115.6 | Async web framework |
| **uvicorn** | 0.34.0 | ASGI server with reload |
| **python-socketio** | 5.11.4 | WebSocket server |
| **aiohttp** | 3.10.11 | Async HTTP client |

### Data Layer
| Package | Version | Purpose |
|---------|---------|---------|
| **SQLAlchemy** | 2.0.36 | ORM |
| **psycopg2-binary** | 2.9.10 | PostgreSQL adapter |
| **GeoAlchemy2** | 0.15.2 | PostGIS integration |
| **Alembic** | 1.14.0 | Database migrations |

### Authentication
| Package | Version | Purpose |
|---------|---------|---------|
| **python-jose** | 3.3.0 | JWT handling |
| **passlib** | 1.7.4 | Password hashing (bcrypt) |
| **python-dotenv** | 1.0.1 | Environment variables |

### Validation
| Package | Version | Purpose |
|---------|---------|---------|
| **pydantic** | 2.10.4 | Data validation |
| **pydantic-settings** | 2.6.1 | Settings management |
| **email-validator** | 2.2.0 | Email validation |

### Testing
| Package | Version | Purpose |
|---------|---------|---------|
| **pytest** | 8.3.4 | Test runner |
| **pytest-asyncio** | 0.24.0 | Async test support |
| **httpx** | 0.28.1 | Async HTTP client for testing |

---

## Configuration (app/config.py)

### Planned Settings Structure

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str

    # JWT
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    FRONTEND_URL: str
    BACKEND_URL: str = "http://localhost:8000"

    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Location & Privacy
    FUZZY_LOCATION_ACCURACY_KM: float = 1.0  # ~1km accuracy
    MAX_NEARBY_RADIUS_KM: float = 50.0
    LOCATION_RETENTION_DAYS: int = 30

    # Mapbox (passed to frontend)
    MAPBOX_TOKEN: str | None = None

    class Config:
        env_file = ".env"

settings = Settings()
```

---

## API Endpoints (Planned)

### Authentication (`/api/auth`)

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| POST | `/auth/register` | Register new user | `RegisterSchema` | `UserResponse` |
| POST | `/auth/login` | Login with email/password | `LoginSchema` | `AuthResponse` |
| POST | `/auth/refresh` | Refresh access token | `RefreshTokenSchema` | `TokenResponse` |
| POST | `/auth/logout` | Logout (invalidate token) | - | `SuccessResponse` |

### Users (`/api/users`)

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| GET | `/users/me` | Get current user profile | - | `UserResponse` |
| PUT | `/users/me` | Update profile | `UserUpdateSchema` | `UserResponse` |
| GET | `/users/nearby` | Find nearby users | `NearbyQuerySchema` | `NearbyUsersResponse` |
| GET | `/users/{user_id}` | Get public profile | - | `PublicUserResponse` |

### Locations (`/api/locations`)

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| POST | `/locations` | Update location | `LocationUpdateSchema` | `LocationResponse` |
| GET | `/locations/me` | Get current location | - | `LocationResponse` |
| DELETE | `/locations` | Clear location | - | `SuccessResponse` |

### Study Sessions (`/api/sessions`)

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| POST | `/sessions` | Start session | `SessionCreateSchema` | `SessionResponse` |
| PUT | `/sessions/{id}/end` | End session | - | `SessionResponse` |
| GET | `/sessions/me` | Get my sessions | - | `SessionsListResponse` |

---

## Socket.io Events (Planned)

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `connect` | - | Client connects |
| `location-update` | `{lat, lng, subject, status}` | User location update |
| `status-update` | `{status}` | User status change |
| `disconnect` | - | Client disconnects |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `nearby-users` | `[{user, distance, location}]` | List of nearby users |
| `user-entered` | `{user, distance, location}` | New user nearby |
| `user-left` | `{user_id}` | User left proximity |
| `user-updated` | `{user}` | User profile updated |
| `error` | `{message}` | Error notification |

---

## Database Models (Planned)

### User Table (`models/user.py`)

```python
from sqlalchemy import Column, String, DateTime, Enum, Integer
from sqlalchemy.dialects.postgresql import UUID
from geoalchemy2 import Geography  # For location data
import uuid
from datetime import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)

    # Profile
    subject = Column(String(100))
    status = Column(Enum('studying', 'break', 'offline', name='user_status'))
    study_duration_minutes = Column(Integer, default=0)

    # Privacy
    privacy_mode = Column(Enum('exact', 'fuzzy', 'invisible', name='privacy_mode'), default='fuzzy')
    show_exact_to_friends = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_seen_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    locations = relationship("UserLocation", back_populates="user")
    sessions = relationship("StudySession", back_populates="user")
```

### UserLocation Table (`models/user_location.py`)

```python
class UserLocation(Base):
    __tablename__ = "user_locations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    # Exact location (private)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    # Fuzzy location (public, ~1km accuracy)
    fuzzy_latitude = Column(Float)
    fuzzy_longitude = Column(Float)

    # Geospatial data (PostGIS)
    coordinates = Column(Geography('POINT', srid=4326))
    fuzzy_coordinates = Column(Geography('POINT', srid=4326))

    # Geocoding
    country_code = Column(String(2))
    city = Column(String(100))
    district = Column(String(100))

    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    user = relationship("User", back_populates="locations")
```

### StudySession Table (`models/study_session.py`)

```python
class StudySession(Base):
    __tablename__ = "study_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    subject = Column(String(100), nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime)
    duration_minutes = Column(Integer)

    participants_count = Column(Integer, default=1)  # For group sessions

    # Relationships
    user = relationship("User", back_populates="sessions")
```

---

## Business Logic Services

### Location Service (`services/location_service.py`)

**Key Functions**:

1. **Fuzzy Location Generation**
```python
def generate_fuzzy_location(lat: float, lng: float, accuracy_km: float = 1.0) -> tuple[float, float]:
    """
    Add random jitter to coordinates to create ~1km accuracy
    """
    # Random offset within ~1km radius
    lat_offset = random.uniform(-0.005, 0.005)  # ~500m
    lng_offset = random.uniform(-0.005, 0.005)
    return (lat + lat_offset, lng + lng_offset)
```

2. **Nearby Users Query (PostGIS)**
```python
async def find_nearby_users(
    lat: float,
    lng: float,
    radius_km: float,
    privacy_mode_filter: list[str] = ['fuzzy']
) -> list[User]:
    """
    Query users within radius using PostGIS ST_DistanceSphere
    Returns users ordered by distance
    """
    # ST_DistanceSphere returns distance in meters
    query = """
    SELECT
        u.*,
        ST_DistanceSphere(
            ul.fuzzy_coordinates,
            ST_MakePoint(:lng, :lat)::geography
        ) as distance_meters
    FROM users u
    JOIN user_locations ul ON u.id = ul.user_id
    WHERE u.privacy_mode = ANY(:privacy_modes)
      AND ST_DWithin(
          ul.fuzzy_coordinates::geography,
          ST_MakePoint(:lng, :lat)::geography,
          :radius_meters
      )
    ORDER BY distance_meters ASC
    LIMIT 100
    """
    # Execute with parameters...
```

3. **Location Data Cleanup**
```python
async def cleanup_old_locations(retention_days: int = 30):
    """
    Delete location records older than retention period (GDPR compliance)
    """
    cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
    await execute(
        delete(UserLocation).where(UserLocation.created_at < cutoff_date)
    )
```

---

## Security Measures

### Authentication Flow

1. **Password Hashing** (passlib + bcrypt)
```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
```

2. **JWT Generation** (python-jose)
```python
from jose import JWTError, jwt

def create_access_token(data: dict, expires_delta: timedelta) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(data: dict) -> str:
    expire = datetime.utcnow() + timedelta(days=7)
    to_encode = data.copy()
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
```

3. **Protected Route Dependency**
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await get_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user
```

---

## Dependency Injection

```python
# app/dependencies.py
from functools import lru_cache
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession

@lru_cache()
def get_settings() -> Settings:
    return Settings()

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    # JWT verification logic...
    return user
```

---

## Docker Configuration

### Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY pyproject.toml requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY ./app ./app

# Expose port
EXPOSE 8000

# Run uvicorn server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

---

## Testing Strategy

### Test Structure (tests/)

```python
# tests/conftest.py
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

@pytest.fixture
async def client():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

@pytest.fixture
async def db_session():
    # Create test database session
    yield session
    # Cleanup after test
```

### Test Coverage Goals
- **Unit Tests**: Services, utilities (80%+ coverage)
- **Integration Tests**: API endpoints, database operations
- **E2E Tests**: WebSocket event flows (with pytest-asyncio)

---

## Next Implementation Steps

1. **Database Setup**
   - Create SQLAlchemy models
   - Write Alembic migrations
   - Initialize PostgreSQL with PostGIS

2. **Authentication**
   - Implement JWT auth service
   - Create auth API endpoints
   - Add password reset flow

3. **Location Service**
   - PostGIS integration
   - Fuzzy location algorithm
   - Nearby users query

4. **Socket.io Server**
   - Initialize Socket.io with FastAPI
   - Implement event handlers
   - Add connection management

5. **API Routes**
   - User CRUD operations
   - Location updates
   - Study sessions

---

**Related Maps**:
- [`/codemaps/architecture.md`](architecture.md) - System architecture
- [`/codemaps/frontend.md`](frontend.md) - Frontend structure
- [`/codemaps/data.md`](data.md) - Database schema details
