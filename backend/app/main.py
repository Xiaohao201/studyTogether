"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy import text

from app.core.config import get_settings
from app.core.database import init_db, close_db, AsyncSessionLocal

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    print("[INFO] Starting StudyTogether API...")
    try:
        await init_db()
        print("[INFO] Database initialized successfully")
    except Exception as e:
        print(f"[WARNING] Database initialization failed: {e}")
        print("[INFO] Application will start anyway, but database features may not work")

    yield

    # Shutdown
    print("[INFO] Shutting down StudyTogether API...")
    try:
        await close_db()
        print("[INFO] Database connections closed")
    except Exception as e:
        print(f"[WARNING] Error during shutdown: {e}")


# Create FastAPI app
app = FastAPI(
    title="StudyTogether API",
    description="Real-time global learning companion platform",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "StudyTogether API",
        "version": "0.1.0",
        "status": "healthy"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint with database status."""
    health_status = {
        "status": "healthy",
        "service": "StudyTogether API",
        "version": "0.1.0"
    }

    # Check database connection
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        health_status["database"] = "connected"
    except Exception as e:
        health_status["status"] = "degraded"
        health_status["database"] = f"disconnected: {str(e)}"

    return health_status


# Include routers
from app.api import auth, users, locations, sessions

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(locations.router, prefix="/api/locations", tags=["Locations"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["Study Sessions"])
