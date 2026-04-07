"""Database configuration and session management."""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import MetaData
from typing import AsyncGenerator

from app.core.config import get_settings

settings = get_settings()

# Get DATABASE_URL (may be constructed from components)
database_url = settings.get_database_url()

# Debug: Print database URL (hide password for security)
safe_url = database_url.split('@')[-1] if '@' in database_url else database_url
print(f"[DEBUG] 🗄️  Database URL (host): ...@{safe_url}")
print(f"[DEBUG] 📋 Full DATABASE_URL from settings: {settings.DATABASE_URL[:50] if settings.DATABASE_URL else 'None'}...")
print(f"[DEBUG] 🔧 PGUSER: '{settings.PGUSER}', PGHOST: '{settings.PGHOST}', POSTGRES_HOST: '{settings.POSTGRES_HOST}'")

# Debug: Print all environment variables (database-related)
import os
db_vars = {k: v for k, v in os.environ.items() if any(keyword in k.upper() for keyword in ['PG', 'DATABASE', 'POSTGRES', 'RAILWAY'])}
print(f"[DEBUG] 🔍 Database-related environment variables:")
for key, value in sorted(db_vars.items()):
    # Hide passwords
    if 'PASSWORD' in key or 'TOKEN' in key:
        value = value[:10] + '...' if len(value) > 10 else '***'
    print(f"  {key}={value}")

# Create async engine
engine = create_async_engine(
    database_url,
    echo=settings.DEBUG,
    future=True,
)

# Create async session maker
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Base class for models
Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency function to get database session.

    Usage in FastAPI:
        @app.get("/users")
        async def get_users(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db():
    """Initialize database (create extensions and tables)."""
    from sqlalchemy import text

    # Try to create PostGIS extension in a separate transaction
    postgis_enabled = False
    try:
        async with engine.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
            print("[INFO] ✓ PostGIS extension enabled successfully")

            # Verify PostGIS is working
            result = await conn.execute(text("SELECT PostGIS_Version()"))
            version = result.scalar()
            print(f"[INFO] ✓ PostGIS version: {version}")
            postgis_enabled = True
    except Exception as e:
        print(f"[WARNING] PostGIS extension not available: {e}")
        print("[INFO] Location features will use decimal coordinates fallback mode")
        print("[INFO] Railway PostgreSQL does not support PostGIS - using standard decimal storage")

    # Create tables in a separate transaction
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print("[INFO] ✓ Database tables initialized")

    return postgis_enabled


async def close_db():
    """Close database connections."""
    await engine.dispose()
