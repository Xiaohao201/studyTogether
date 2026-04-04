# StudyTogether - Frontend Code Map

> **Last Updated**: 2026-01-26
> **Framework**: Next.js 14 (App Router)
> **Language**: TypeScript 5.x

## Directory Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx         # Root layout with metadata
│   ├── page.tsx           # Landing page (home)
│   └── globals.css        # Global styles
│
├── components/            # React components
│   └── ui/               # shadcn/ui components
│       └── button.tsx    # Reusable button component
│
├── lib/                  # Utility libraries
│   └── utils.ts         # Helper functions (cn, etc.)
│
├── types/               # TypeScript type definitions
│   └── index.ts         # Shared application types
│
├── public/              # Static assets (not yet created)
├── next.config.js       # Next.js configuration
├── tailwind.config.ts   # Tailwind CSS configuration
├── tsconfig.json        # TypeScript configuration
└── package.json         # Dependencies and scripts

```

---

## Key Modules

### 1. App Router (`/app`)

#### `layout.tsx` - Root Layout
- **Purpose**: Global layout wrapper
- **Features**:
  - Inter font integration
  - Chinese language support (`lang="zh-CN"`)
  - SEO metadata configuration
- **Metadata**: Title, description for search engines

#### `page.tsx` - Landing Page
- **Purpose**: Home page with marketing content
- **Key Sections**:
  - Navigation (Login/Register buttons)
  - Hero section (headline + CTA)
  - Feature cards (3 cards: 🌍 Global Map, 📍 Nearby Match, 🔒 Privacy)
  - Social proof ("数千名学习者")
- **Routes Referenced**:
  - `/login` - Authentication page
  - `/register` - Registration page
  - `/map` - Learning map view

---

### 2. Components (`/components`)

#### UI Components (`/components/ui`)

**`button.tsx`** - shadcn/ui Button
- **Props**: `variant`, `size`, `asChild`, etc.
- **Variants**: `default` | `destructive` | `outline` | `ghost` | `link`
- **Sizes**: `default` | `sm` | `lg` | `icon`
- **Styling**: Tailwind CSS with `class-variance-authority`

---

### 3. Type System (`/types/index.ts`)

#### Core Types

**User Management**
```typescript
interface User {
  id: string
  username: string
  email?: string
  subject?: string
  status: 'studying' | 'break' | 'offline'
  study_duration_minutes: number
  privacy_mode: 'exact' | 'fuzzy' | 'invisible'
  show_exact_to_friends: boolean
  created_at: string
  updated_at: string
  last_seen_at: string
}
```

**Location Data**
```typescript
interface UserLocation {
  id: string
  user_id: string
  latitude: number
  longitude: string
  fuzzy_latitude?: number
  fuzzy_longitude?: number
  country_code?: string
  city?: string
  district?: string
  created_at: string
}

interface NearbyUser extends User {
  distance_meters: number
  location: { latitude: number; longitude: number }
}
```

**API Responses**
```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

interface AuthResponse {
  access_token: string
  refresh_token: string
  user: User
}
```

**Socket Events**
```typescript
interface SocketLocationUpdate {
  latitude: number
  longitude: number
  subject?: string
  status?: UserStatus
}

interface SocketNearbyUsers {
  users: NearbyUser[]
}

interface SocketUserEntered {
  user: NearbyUser
}

interface SocketUserLeft {
  user_id: string
}
```

---

### 4. Utilities (`/lib/utils.ts`)

#### `cn()` Function
- **Purpose**: Merge Tailwind CSS classes with conflict resolution
- **Implementation**: Uses `clsx` + `tailwind-merge`
- **Usage**: `cn("base-class", conditionalClass, variantClass)`

---

## Dependencies Breakdown

### Core Framework
```json
{
  "next": "14.2.15",           // React framework
  "react": "^18.3.1",          // UI library
  "react-dom": "^18.3.1"       // DOM rendering
}
```

### State & Data
```json
{
  "zustand": "^4.5.5",         // State management (planned use)
  "axios": "^1.7.9",           // HTTP client (planned use)
  "zod": "^3.23.8"             // Schema validation (planned use)
}
```

### Real-Time & Maps
```json
{
  "socket.io-client": "^4.8.1",  // WebSocket client
  "mapbox-gl": "^3.9.2"          // Map rendering
}
```

### UI & Styling
```json
{
  "tailwindcss": "^3.4.1",           // Utility CSS
  "tailwind-merge": "^2.5.5",        // Merge class names
  "class-variance-authority": "^0.7.1",  // Component variants
  "lucide-react": "^0.462.0",        // Icon library
  "@radix-ui/react-dialog": "^1.1.4",
  "@radix-ui/react-dropdown-menu": "^2.1.4",
  "@radix-ui/react-label": "^2.1.1",
  "@radix-ui/react-select": "^2.1.4",
  "@radix-ui/react-slot": "^1.1.1",
  "@radix-ui/react-toast": "^1.2.4"
}
```

### Forms
```json
{
  "react-hook-form": "^7.53.2",
  "@hookform/resolvers": "^3.9.1"
}
```

### Utilities
```json
{
  "date-fns": "^4.1.0",       // Date formatting
  "clsx": "^2.1.1"            // Conditional classes
}
```

---

## Configuration Files

### `next.config.js`
- **Purpose**: Next.js customization
- **Current**: Default configuration

### `tailwind.config.ts`
- **Purpose**: Tailwind CSS theme customization
- **Plugins**: `tailwindcss-animate`
- **Dark Mode**: Class-based (`.dark`)

### `tsconfig.json`
- **Target**: ES2017
- **Module**: ESNext
- **Strict Mode**: Enabled
- **Path Aliases**: `@/*` → `./`

---

## Scripts (package.json)

```json
{
  "dev": "next dev",              // Development server (localhost:3000)
  "build": "next build",          // Production build
  "start": "next start",          // Production server
  "lint": "next lint",            // ESLint checking
  "type-check": "tsc --noEmit"    // TypeScript type checking
}
```

---

## Planned Pages (To Be Implemented)

| Route | Component | Status | Description |
|-------|-----------|--------|-------------|
| `/` | `page.tsx` | ✅ Done | Landing page |
| `/login` | - | ⏳ TODO | User authentication |
| `/register` | - | ⏳ TODO | New user registration |
| `/map` | - | ⏳ TODO | Global learning map |
| `/profile` | - | ⏳ TODO | User profile settings |
| `/study/[id]` | - | ⏳ TODO | Study session details |

---

## State Management Strategy (Planned)

### Zustand Stores (To Be Created)

**Auth Store**
```typescript
interface AuthStore {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}
```

**Location Store**
```typescript
interface LocationStore {
  currentLocation: { lat: number; lng: number } | null
  nearbyUsers: NearbyUser[]
  isTracking: boolean
  startTracking: () => void
  stopTracking: () => void
  updateLocation: (lat: number, lng: number) => void
}
```

**Socket Store**
```typescript
interface SocketStore {
  socket: Socket | null
  isConnected: boolean
  connect: () => void
  disconnect: () => void
  emit: (event: string, data: any) => void
}
```

---

## API Integration Pattern (Planned)

```typescript
// lib/api.ts (to be created)
import axios from 'axios'
import type { ApiResponse } from '@/types'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: Add JWT token
api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: Handle token refresh
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      // Refresh token logic
    }
    return Promise.reject(error)
  }
)
```

---

## Next Development Steps

1. **Create API Client Layer**
   - Set up axios instance with interceptors
   - Implement JWT refresh logic
   - Create typed API functions

2. **Implement Authentication Pages**
   - Login form with validation
   - Registration form
   - Password reset flow

3. **Map Integration**
   - Install Mapbox dependencies
   - Create map component with markers
   - Add clustering for dense areas

4. **Socket.io Integration**
   - Initialize socket connection
   - Set up event listeners
   - Handle reconnection logic

5. **State Management**
   - Create Zustand stores
   - Implement persistence (localStorage)
   - Add hydration for SSR

---

**Related Maps**:
- [`/codemaps/architecture.md`](architecture.md) - System-wide architecture
- [`/codemaps/backend.md`](backend.md) - Backend API structure
- [`/codemaps/data.md`](data.md) - Database schema
