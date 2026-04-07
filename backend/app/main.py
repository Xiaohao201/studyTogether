"""FastAPI application entry point."""

import logging
import socketio
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy import text

from app.core.config import get_settings
from app.core.database import init_db, close_db, AsyncSessionLocal

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    print("=" * 60)
    print("[INFO] 🚀 Starting StudyTogether API...")
    print("[INFO] ⭐⭐⭐ CORS FIX DEPLOYMENT - 2025-04-06-09:00 ⭐⭐⭐")  # NEW MARKER!
    print(f"[INFO] 📦 Environment: {settings.ENVIRONMENT}")
    print(f"[INFO] 🔧 Debug mode: {settings.DEBUG}")

    # Get database URL safely
    try:
        db_url = settings.get_database_url()
        print(f"[INFO] 🗄️  Database: {db_url[:30]}...")
    except Exception as e:
        print(f"[WARNING] Database URL not configured: {e}")

    print("=" * 60)

    try:
        await init_db()
        print("[INFO] ✅ Application started successfully!")
    except Exception as e:
        print(f"[ERROR] ❌ Database initialization failed: {e}")
        print("[INFO] ⚠️  Application will start anyway, but features may be limited")

    yield

    # Shutdown
    print("[INFO] 🛑 Shutting down StudyTogether API...")
    try:
        await close_db()
        print("[INFO] ✅ Database connections closed")
    except Exception as e:
        print(f"[WARNING] ⚠️  Error during shutdown: {e}")


# Create FastAPI app
app = FastAPI(
    title="StudyTogether API",
    description="Real-time global learning companion platform",
    version="0.1.0",
    lifespan=lifespan,
)

logger.info("=" * 60)
logger.info("[DEBUG] 🚀 StudyTogether API starting with NEW CORS CONFIG...")
logger.info("[DEBUG] 📦 CORS is configured to allow all origins (*)")
logger.info("[DEBUG] 🔗 This deployment includes explicit OPTIONS handler")
logger.info("=" * 60)

# Configure CORS - MUST be added before other middleware
# Allow all origins for public API accessibility
# This is safe because sensitive endpoints require JWT authentication
# Note: allow_credentials=False when using allow_origins=["*"] (CORS spec requirement)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for public API
    allow_credentials=False,  # Must be False when using wildcard origin (CORS spec)
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)

# Handle OPTIONS requests explicitly for CORS preflight
from fastapi import Request
@app.options("/{path:path}")
async def options_handler(request: Request, path: str):
    """Handle OPTIONS requests for CORS preflight."""
    origin = request.headers.get("origin", "unknown")
    logger.info(f"[CORS] Handling OPTIONS request for: /{path} from origin: {origin}")

    headers = {
        "Access-Control-Allow-Origin": "*",  # Allow all origins
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "600",
    }
    logger.info(f"[CORS] Returning headers: {list(headers.keys())}")
    return Response(headers=headers)


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
        "version": "0.1.0",
        "database": "unknown"
    }

    # Check database connection
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        health_status["database"] = "connected"
    except Exception as e:
        print(f"[ERROR] Database health check failed: {e}")
        health_status["status"] = "unhealthy"
        health_status["database"] = f"disconnected: {str(e)}"

    return health_status


@app.get("/health/ready")
async def readiness_check():
    """Simple readiness check (always returns 200 if service is running)."""
    return {
        "status": "ready",
        "service": "StudyTogether API",
        "version": "0.1.0"
    }


@app.get("/debug/postgis")
async def check_postgis():
    """Check PostGIS availability and version."""
    from sqlalchemy import text

    result = {
        "postgis_enabled": False,
        "postgis_version": None,
        "error": None
    }

    try:
        async with AsyncSessionLocal() as db:
            # Check if PostGIS extension exists
            query = text("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'postgis')")
            exists = await db.execute(query)
            result["postgis_enabled"] = exists.scalar()

            if result["postgis_enabled"]:
                # Get PostGIS version
                version_query = text("SELECT PostGIS_Version()")
                version = await db.execute(version_query)
                result["postgis_version"] = version.scalar()
    except Exception as e:
        result["error"] = str(e)

    return result


@app.post("/admin/run-migrations")
async def run_migrations():
    """
    Manually run Alembic database migrations.

    WARNING: Only use this endpoint for initial setup or manual migration.
    """
    import subprocess
    import json

    try:
        # Run alembic upgrade head
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            capture_output=True,
            text=True,
            timeout=60
        )

        output = {
            "success": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode
        }

        if result.returncode == 0:
            print("[INFO] ✅ Database migrations completed successfully")
        else:
            print(f"[ERROR] ❌ Migration failed with return code {result.returncode}")

        return output
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": "Migration timed out after 60 seconds"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@app.post("/admin/enable-postgis")
async def enable_postgis_extension():
    """
    Manually enable PostGIS extension on Railway PostgreSQL.

    This endpoint tries to create the PostGIS extension if it doesn't exist.
    Only works if Railway PostgreSQL image supports PostGIS.
    """
    from sqlalchemy import text

    try:
        async with AsyncSessionLocal() as db:
            # Try to enable PostGIS extension
            await db.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
            await db.commit()

            # Verify PostGIS is enabled
            version_query = text("SELECT PostGIS_Version()")
            version = await db.execute(version_query)
            postgis_version = version.scalar()

            return {
                "success": True,
                "message": "PostGIS extension enabled successfully",
                "postgis_version": postgis_version
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "hint": "Railway PostgreSQL might not support PostGIS. Consider using the decimal coordinates fallback instead."
        }


# Include routers
from app.api import auth, users, locations, sessions, calls

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(locations.router, prefix="/api/locations", tags=["Locations"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["Study Sessions"])
app.include_router(calls.router, prefix="/api/calls", tags=["Calls"])

# Setup Socket.io
from app.socket import sio, connected_users
from app.socket.call_handler import register_call_handlers

# Register call handlers
register_call_handlers()

# Create Socket.io ASGI app
socket_app = socketio.ASGIApp(sio, app)

# Export socket_app for uvicorn to use
__all__ = ["app", "socket_app"]
