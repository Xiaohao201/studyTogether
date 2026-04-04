# StudyTogether - Database & Data Model

> **Last Updated**: 2026-01-26
> **Database**: PostgreSQL 15 + PostGIS 3.3
> **ORM**: SQLAlchemy 2.0 (Async)
> **Status**: Schema Design (Implementation Pending)

## Database Overview

### Technology Rationale

**PostgreSQL + PostGIS**
- **Why PostgreSQL?**
  - ACID compliance for data integrity
  - Excellent JSON support for flexible schemas
  - Strong indexing capabilities
  - Proven reliability at scale

- **Why PostGIS?**
  - Geographic data types (POINT, POLYGON)
  - Spatial indexing for fast proximity queries
  - Built-in functions: `ST_DistanceSphere`, `ST_DWithin`, `ST_MakePoint`
  - Support for coordinate systems (SRID 4326 for GPS)

---

## Core Tables

### 1. Users Table

```sql
CREATE TABLE users (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Authentication
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,

    -- Profile
    subject VARCHAR(100),
    status VARCHAR(20) CHECK (status IN ('studying', 'break', 'offline')),
    study_duration_minutes INTEGER DEFAULT 0,

    -- Privacy Settings
    privacy_mode VARCHAR(20) CHECK (privacy_mode IN ('exact', 'fuzzy', 'invisible')) DEFAULT 'fuzzy',
    show_exact_to_friends BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_last_seen ON users(last_seen_at);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

#### Fields Explained

| Field | Type | Purpose | Example |
|-------|------|---------|---------|
| `id` | UUID | Unique identifier | `550e8400-e29b-41d4-a716-446655440000` |
| `username` | VARCHAR(50) | Display name (unique) | `"xiaoming"` |
| `email` | VARCHAR(255) | Login email | `"xiaoming@example.com"` |
| `hashed_password` | VARCHAR(255) | Bcrypt hash | `"$2b$12$..."` |
| `subject` | VARCHAR(100) | Current study subject | `"考研数学"` |
| `status` | ENUM | Current activity | `"studying"` |
| `study_duration_minutes` | INTEGER | Total study time | `120` |
| `privacy_mode` | ENUM | Location visibility | `"fuzzy"` |
| `show_exact_to_friends` | BOOLEAN | Friends see exact location | `false` |
| `last_seen_at` | TIMESTAMPTZ | Last activity timestamp | `2026-01-26 15:30:00+00` |

---

### 2. User Locations Table

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE user_locations (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign Key
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Exact Location (Private)
    latitude DECIMAL(10, 8) NOT NULL,  -- Precise to ~1m
    longitude DECIMAL(11, 8) NOT NULL,

    -- Fuzzy Location (Public, ~1km accuracy)
    fuzzy_latitude DECIMAL(10, 8),
    fuzzy_longitude DECIMAL(11, 8),

    -- PostGIS Geography Types (for spatial queries)
    coordinates GEOGRAPHY(POINT, 4326),  -- WGS84 (GPS coordinates)
    fuzzy_coordinates GEOGRAPHY(POINT, 4326),

    -- Geocoding Results (Cached)
    country_code VARCHAR(2),      -- ISO 3166-1 alpha-2
    city VARCHAR(100),
    district VARCHAR(100),

    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for spatial queries
CREATE INDEX idx_user_locations_user_id ON user_locations(user_id);
CREATE INDEX idx_user_locations_created_at ON user_locations(created_at);

-- GiST index for PostGIS (critical for nearby queries)
CREATE INDEX idx_user_locations_fuzzy_coordinates_gist
    ON user_locations USING GIST (fuzzy_coordinates);

-- Compound index for recent locations
CREATE INDEX idx_user_locations_user_created
    ON user_locations(user_id, created_at DESC);
```

#### Fields Explained

| Field | Type | Purpose | Example |
|-------|------|---------|---------|
| `latitude` | DECIMAL(10,8) | GPS latitude (±90°) | `39.90420000` (Beijing) |
| `longitude` | DECIMAL(11,8) | GPS longitude (±180°) | `116.40740000` |
| `fuzzy_latitude` | DECIMAL(10,8) | Jittered latitude | `39.90845234` |
| `fuzzy_longitude` | DECIMAL(11,8) | Jittered longitude | `116.41123456` |
| `coordinates` | GEOGRAPHY(POINT) | PostGIS exact location | `POINT(116.4074 39.9042)` |
| `fuzzy_coordinates` | GEOGRAPHY(POINT) | PostGIS fuzzy location | `POINT(116.4112 39.9085)` |
| `country_code` | VARCHAR(2) | ISO country code | `"CN"` |
| `city` | VARCHAR(100) | City name (geocoded) | `"北京市"` |
| `district` | VARCHAR(100) | District name | `"朝阳区"` |

#### PostGIS Data Types

**GEOGRAPHY vs GEOMETRY**
- `GEOGRAPHY(POINT, 4326)`: Geodetic coordinates (lat/lng), meters for distance
- `GEOMETRY(POINT, 4326)`: Planar coordinates, degrees for distance
- **We use GEOGRAPHY** for accurate meter-based distance calculations

**Example Query: Nearby Users**
```sql
-- Find users within 5km, ordered by distance
SELECT
    u.username,
    u.subject,
    ul.city,
    ST_DistanceSphere(
        ul.fuzzy_coordinates,
        ST_MakePoint(116.4074, 39.9042)::geography
    ) as distance_meters
FROM users u
JOIN user_locations ul ON u.id = ul.user_id
WHERE ST_DWithin(
    ul.fuzzy_coordinates::geography,
    ST_MakePoint(116.4074, 39.9042)::geography,
    5000  -- 5km radius in meters
)
ORDER BY distance_meters ASC
LIMIT 20;
```

---

### 3. Study Sessions Table

```sql
CREATE TABLE study_sessions (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign Key
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Session Details
    subject VARCHAR(100) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,

    -- Social Features
    participants_count INTEGER DEFAULT 1,  -- For future group sessions

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_study_sessions_user_id ON study_sessions(user_id);
CREATE INDEX idx_study_sessions_started_at ON study_sessions(started_at DESC);
CREATE INDEX idx_study_sessions_subject ON study_sessions(subject);

-- Active sessions index (for ongoing sessions)
CREATE INDEX idx_study_sessions_active
    ON study_sessions(user_id, started_at DESC)
    WHERE ended_at IS NULL;
```

#### Fields Explained

| Field | Type | Purpose | Example |
|-------|------|---------|---------|
| `subject` | VARCHAR(100) | Study topic | `"Python编程"` |
| `started_at` | TIMESTAMPTZ | Session start | `2026-01-26 10:00:00+00` |
| `ended_at` | TIMESTAMPTZ | Session end | `2026-01-26 12:00:00+00` |
| `duration_minutes` | INTEGER | Calculated duration | `120` |
| `participants_count` | INTEGER | Group session size | `3` |

---

## Relationships (ER Diagram)

```
┌─────────────────┐
│     Users       │
│─────────────────│
│ id (PK)         │◄────────────────┐
│ username        │                  │
│ email           │                  │
│ subject         │                  │
│ status          │                  │
│ privacy_mode    │                  │
└─────────────────┘                  │
       │                             │
       │ 1:N                        │
       │                             │
       ▼                             │
┌─────────────────┐                  │
│ User Locations  │                  │
│─────────────────│                  │
│ id (PK)         │                  │
│ user_id (FK)    │                  │
│ coordinates     │                  │
│ fuzzy_coord*    │                  │
│ city            │                  │
└─────────────────┘                  │
       │                             │
       │                             │
       └──────────────┐              │
                      │              │
                      ▼              │
              ┌─────────────────┐   │
              │ Study Sessions  │   │
              │─────────────────│   │
              │ id (PK)         │   │
              │ user_id (FK)────│───┘
              │ subject         │
              │ started_at      │
              │ ended_at        │
              └─────────────────┘
```

---

## Privacy & Data Retention

### Location Data Lifecycle

```
User updates location
         │
         ▼
Store exact location (private)
         │
         ├─► Generate fuzzy location (add ~500m random offset)
         │   - Used for public map display
         │   - Used for nearby matching
         │
         ├─► Geocode coordinates (city, district)
         │   - Cached in user_locations table
         │
         └─► Schedule cleanup job
             - Delete records older than 30 days
             - Runs daily via cron/Python APScheduler
```

### GDPR Compliance

**Right to Erasure (Article 17)**
```sql
-- User requests account deletion
DELETE FROM user_locations WHERE user_id = :user_id;
DELETE FROM study_sessions WHERE user_id = :user_id;
DELETE FROM users WHERE id = :user_id;
```

**Right to Export (Article 15)**
```sql
-- User requests data export
SELECT
    u.*,
    json_agg(
        json_build_object(
            'latitude', ul.latitude,
            'longitude', ul.longitude,
            'created_at', ul.created_at
        )
    ) as locations,
    json_agg(
        json_build_object(
            'subject', ss.subject,
            'started_at', ss.started_at,
            'duration_minutes', ss.duration_minutes
        )
    ) as sessions
FROM users u
LEFT JOIN user_locations ul ON u.id = ul.user_id
LEFT JOIN study_sessions ss ON u.id = ss.user_id
WHERE u.id = :user_id
GROUP BY u.id;
```

---

## Database Migrations (Alembic)

### Migration Naming Convention

```
alembic/versions/
├── 001_initial_schema.py          # Create users, user_locations, study_sessions
├── 002_add_postgis_extension.py   # Enable PostGIS
├── 003_add_indexes.py             # Performance indexes
├── 004_add_fuzzy_location.py      # Add fuzzy columns
└── 005_add_cleanup_job.py         # Data retention cleanup
```

### Example Migration

```python
# alembic/versions/001_initial_schema.py
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

def upgrade():
    op.create_table(
        'users',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('username', sa.String(50), unique=True, nullable=False),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('subject', sa.String(100)),
        sa.Column('status', sa.String(20)),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True)),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True)),
    )
    # ... create indexes

def downgrade():
    op.drop_table('users')
```

---

## Performance Optimization

### Indexing Strategy

1. **B-tree Indexes** (standard indexes)
   - `users.email`, `users.username` (unique lookups)
   - `user_locations.user_id` (foreign key)
   - `study_sessions.started_at` (time-based queries)

2. **GiST Indexes** (spatial indexes)
   - `user_locations.fuzzy_coordinates` (PostGIS proximity queries)
   - Critical for performance: O(log n) vs O(n) scan

3. **Partial Indexes** (filtered indexes)
   ```sql
   CREATE INDEX idx_users_active
       ON users(status)
       WHERE status = 'studying';
   ```

### Query Optimization

**Bad: Full table scan**
```sql
SELECT * FROM users WHERE status = 'studying';  -- No index!
```

**Good: Index scan**
```sql
SELECT * FROM users WHERE status = 'studying';  -- Uses idx_users_status
```

**Bad: Calculate distance for all users**
```sql
SELECT *, ST_DistanceSphere(...) as distance
FROM users, user_locations
WHERE ST_DistanceSphere(...) < 5000;  -- Scans entire table!
```

**Good: Use ST_DWithin (index-aware)**
```sql
SELECT *
FROM users u
JOIN user_locations ul ON u.id = ul.user_id
WHERE ST_DWithin(
    ul.fuzzy_coordinates::geography,
    ST_MakePoint(:lng, :lat)::geography,
    5000
);  -- Uses GiST index!
```

---

## Scaling Considerations

### Partitioning (for large-scale deployments)

**By Date (user_locations)**
```sql
-- Partition user_locations by month
CREATE TABLE user_locations_2026_01
    PARTITION OF user_locations
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE user_locations_2026_02
    PARTITION OF user_locations
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
```

### Replication

**Read Replicas for Scaling**
- **Primary**: Write operations (login, location updates)
- **Replicas**: Read operations (nearby queries, profile views)
- **Benefit**: Distribute read load across multiple nodes

### Caching Strategy

**Redis Cache for Nearby Queries**
```python
# Cache key: "nearby:{lat_rounded}:{lng_rounded}:{radius}"
# TTL: 30 seconds (stale but acceptable)
cache_key = f"nearby:{lat:.2f}:{lng:.2f}:{radius}"

cached_users = await redis.get(cache_key)
if cached_users:
    return json.loads(cached_users)

# Query database
users = await find_nearby_users(lat, lng, radius)
await redis.setex(cache_key, 30, json.dumps(users))
```

---

## Data Access Patterns

### Common Queries

**1. Authenticate User**
```sql
SELECT id, username, hashed_password
FROM users
WHERE email = :email;
-- Uses: idx_users_email
```

**2. Update Location**
```sql
INSERT INTO user_locations (user_id, latitude, longitude, fuzzy_latitude, fuzzy_longitude, coordinates, fuzzy_coordinates)
VALUES (:user_id, :lat, :lng, :fuzzy_lat, :fuzzy_lng, ST_MakePoint(:lng, :lat)::geography, ST_MakePoint(:fuzzy_lng, :fuzzy_lat)::geography);
```

**3. Find Nearby Users**
```sql
SELECT
    u.id, u.username, u.subject, u.status,
    ul.city,
    ul.district,
    ST_DistanceSphere(ul.fuzzy_coordinates, ST_MakePoint(:lng, :lat)::geography) as distance_meters
FROM users u
JOIN user_locations ul ON u.id = ul.user_id
WHERE u.privacy_mode IN ('fuzzy', 'exact')  -- Respect privacy
  AND ST_DWithin(
      ul.fuzzy_coordinates::geography,
      ST_MakePoint(:lng, :lat)::geography,
      :radius_meters
  )
  AND u.status = 'studying'  -- Only active learners
ORDER BY distance_meters ASC
LIMIT 20;
-- Uses: idx_user_locations_fuzzy_coordinates_gist (GiST index)
```

**4. Cleanup Old Locations (GDPR)**
```sql
DELETE FROM user_locations
WHERE created_at < NOW() - INTERVAL '30 days';
```

---

## Next Steps

1. **Initialize Database**
   ```bash
   docker-compose up postgres  # Start PostgreSQL
   docker exec -it studytogether-db psql -U studytogether -d studytogether
   CREATE EXTENSION postgis;  # Enable PostGIS
   ```

2. **Run Migrations**
   ```bash
   cd backend
   alembic upgrade head  # Create tables
   ```

3. **Seed Test Data**
   ```python
   # Create test users in Beijing
   create_test_user(username="xiaoming", lat=39.9042, lng=116.4074, subject="考研数学")
   create_test_user(username="xiaohong", lat=39.9100, lng=116.4100, subject="英语")
   ```

4. **Test Spatial Queries**
   ```sql
   -- Find users within 1km of Tiananmen
   SELECT username, city, ST_DistanceSphere(
       fuzzy_coordinates,
       ST_MakePoint(116.4074, 39.9042)::geography
   ) as distance_meters
   FROM users u
   JOIN user_locations ul ON u.id = ul.user_id
   WHERE ST_DWithin(
       ul.fuzzy_coordinates::geography,
       ST_MakePoint(116.4074, 39.9042)::geography,
       1000
   );
   ```

---

**Related Maps**:
- [`/codemaps/architecture.md`](architecture.md) - System architecture
- [`/codemaps/backend.md`](backend.md) - Backend API structure
- [`/codemaps/frontend.md`](frontend.md) - Frontend components
