# StudyTogether API Documentation

> **API Version**: 0.1.0 | **Base URL**: `http://localhost:8000`

---

## 📋 Overview

StudyTogether provides a RESTful API for user authentication, location management, and study session tracking.

### Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_access_token>
```

### Response Format

All responses follow this structure:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "message": null
}
```

---

## 🔐 Authentication Endpoints

### Register User

Register a new user account.

**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "username": "xiaoming",
  "email": "xiaoming@example.com",
  "password": "password123"
}
```

**Response:** `201 Created`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "xiaoming",
  "email": "xiaoming@example.com",
  "subject": null,
  "status": "offline",
  "privacy_mode": "fuzzy",
  "study_duration_minutes": 0,
  "show_exact_to_friends": false,
  "created_at": "2026-01-26T10:00:00Z",
  "updated_at": "2026-01-26T10:00:00Z",
  "last_seen_at": "2026-01-26T10:00:00Z"
}
```

**Validation Rules:**
- `username`: 3-50 characters, unique
- `email`: Valid email format, unique
- `password`: Min 8 characters

---

### Login

Authenticate with email and password.

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "xiaoming@example.com",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "xiaoming",
    "email": "xiaoming@example.com",
    ...
  }
}
```

**Token Expiry:**
- Access Token: 15 minutes
- Refresh Token: 7 days

---

### Get Current User

Get authenticated user's profile.

**Endpoint:** `GET /api/auth/me`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "xiaoming",
  "email": "xiaoming@example.com",
  "subject": "Python编程",
  "status": "studying",
  "privacy_mode": "fuzzy",
  "study_duration_minutes": 120
}
```

---

### Update Profile

Update current user's profile.

**Endpoint:** `PUT /api/auth/me`

**Headers:** `Authorization: Bearer <token>`

**Request Body:** (all fields optional)
```json
{
  "username": "xiaoming_new",
  "subject": "考研数学",
  "status": "studying",
  "privacy_mode": "fuzzy",
  "show_exact_to_friends": false
}
```

**Valid Values:**
- `status`: `"studying"` | `"break"` | `"offline"`
- `privacy_mode`: `"exact"` | `"fuzzy"` | `"invisible"`

---

## 👥 Users Endpoints

### Get Public Profile

Get a user's public profile (non-sensitive data only).

**Endpoint:** `GET /api/users/{user_id}`

**Response:** `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "xiaoming",
  "subject": "Python编程",
  "status": "studying",
  "study_duration_minutes": 120
}
```

---

## 📍 Location Endpoints

### Create/Update Location

Create or update current location.

**Endpoint:** `POST /api/locations/`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "latitude": 39.9042,
  "longitude": 116.4074
}
```

**Response:** `201 Created`
```json
{
  "id": "location-id",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "latitude": 39.9042,
  "longitude": 116.4074,
  "fuzzy_latitude": 39.9085,
  "fuzzy_longitude": 116.4112,
  "city": null,
  "district": null,
  "country_code": null,
  "created_at": "2026-01-26T10:00:00Z"
}
```

**Privacy:**
- Exact location stored privately
- Fuzzy location (±500m) generated automatically for public display

---

### Get My Location

Get current user's latest location.

**Endpoint:** `GET /api/locations/me`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "id": "location-id",
  "latitude": 39.9042,
  "longitude": 116.4074,
  "fuzzy_latitude": 39.9085,
  "fuzzy_longitude": 116.4112,
  ...
}
```

---

### Find Nearby Users

Find nearby users who are currently studying.

**Endpoint:** `GET /api/locations/nearby`

**Query Parameters:**
- `latitude` (required): Your latitude
- `longitude` (required): Your longitude
- `radius_km` (optional): Search radius in km (0.1-50, default: 5)

**Example:**
```
GET /api/locations/nearby?latitude=39.9042&longitude=116.4074&radius_km=5
```

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
[
  {
    "id": "user-id-1",
    "username": "xiaohong",
    "subject": "英语",
    "status": "studying",
    "distance_meters": 234.5,
    "location": {
      "latitude": 39.9065,
      "longitude": 116.4098
    },
    "city": null,
    "district": null
  },
  {
    "id": "user-id-2",
    "username": "xiaowang",
    "subject": "Python",
    "status": "studying",
    "distance_meters": 567.8,
    ...
  }
]
```

**Filtering:**
- Only users with `privacy_mode='fuzzy'` or `'exact'`
- Only users with `status='studying'`
- Results sorted by distance (nearest first)

---

### Delete Location

Delete current user's location (go invisible).

**Endpoint:** `DELETE /api/locations/`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "message": "Location deleted successfully"
}
```

---

### Location Statistics

Get location statistics.

**Endpoint:** `GET /api/locations/stats`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "location_count": 15
}
```

---

## 📚 Study Session Endpoints

### Start Session

Start a new study session.

**Endpoint:** `POST /api/sessions/`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "subject": "Python编程"
}
```

**Response:** `201 Created`
```json
{
  "id": "session-id",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "subject": "Python编程",
  "started_at": "2026-01-26T10:00:00Z",
  "ended_at": null,
  "duration_minutes": null,
  "participants_count": 1
}
```

**Constraints:**
- User can only have one active session at a time

---

### End Session

End an active study session.

**Endpoint:** `PUT /api/sessions/{session_id}/end`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "id": "session-id",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "subject": "Python编程",
  "started_at": "2026-01-26T10:00:00Z",
  "ended_at": "2026-01-26T12:00:00Z",
  "duration_minutes": 120,
  "participants_count": 1
}
```

**Side Effects:**
- Calculates `duration_minutes`
- Updates user's `study_duration_minutes` total

---

### Get Session

Get details of a specific session.

**Endpoint:** `GET /api/sessions/{session_id}`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK` (session object)

---

### Get My Sessions

Get all sessions for current user.

**Endpoint:** `GET /api/sessions/`

**Query Parameters:**
- `limit` (optional): Max sessions to return (default: 50)

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
[
  {
    "id": "session-1",
    "subject": "Python编程",
    "started_at": "2026-01-26T10:00:00Z",
    "ended_at": "2026-01-26T12:00:00Z",
    "duration_minutes": 120
  },
  {
    "id": "session-2",
    "subject": "考研数学",
    "started_at": "2026-01-25T14:00:00Z",
    "ended_at": "2026-01-25T16:30:00Z",
    "duration_minutes": 150
  }
]
```

**Order:** Newest sessions first

---

### Get Active Session

Get current user's active session.

**Endpoint:** `GET /api/sessions/active`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK` (session object)

**Error:** `404 Not Found` if no active session

---

## 🔧 Health Check

### API Health

Check API health status.

**Endpoint:** `GET /health`

**Response:** `200 OK`
```json
{
  "status": "healthy"
}
```

---

## 🚨 Error Responses

### 400 Bad Request
```json
{
  "detail": "You already have an active session. Please end it first."
}
```

### 401 Unauthorized
```json
{
  "detail": "Could not validate credentials"
}
```

### 404 Not Found
```json
{
  "detail": "User not found"
}
```

### 422 Validation Error
```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

---

## 📚 Interactive Documentation

### Swagger UI
- **URL**: http://localhost:8000/docs
- **Features**: Try out API endpoints directly from browser

### ReDoc
- **URL**: http://localhost:8000/redoc
- **Features**: Readable API documentation

---

## 🧪 Testing with cURL

### Register and Login
```bash
# Register
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"xiaoming","email":"xiaoming@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"xiaoming@example.com","password":"password123"}'

# Save token
TOKEN="<your_access_token>"
```

### Update Location
```bash
curl -X POST http://localhost:8000/api/locations/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitude":39.9042,"longitude":116.4074}'
```

### Find Nearby Users
```bash
curl -X GET "http://localhost:8000/api/locations/nearby?latitude=39.9042&longitude=116.4074&radius_km=5" \
  -H "Authorization: Bearer $TOKEN"
```

### Start Study Session
```bash
curl -X POST http://localhost:8000/api/sessions/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subject":"Python编程"}'
```

---

**Last Updated**: 2026-01-26
**API Version**: 0.1.0
