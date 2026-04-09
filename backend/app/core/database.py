"""Database configuration and session management."""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import MetaData
from typing import AsyncGenerator

from app.core.config import get_settings

settings = get_settings()

# Get DATABASE_URL (may be constructed from components)
database_url = settings.get_database_url()

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
    """Initialize database extensions.

    Table creation is handled by Alembic (Dockerfile CMD: alembic upgrade head).
    This function only checks/enables PostGIS and validates connectivity.
    """
    from sqlalchemy import text

    # Try to create PostGIS extension
    postgis_enabled = False
    try:
        async with engine.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
            result = await conn.execute(text("SELECT PostGIS_Version()"))
            version = result.scalar()
            print(f"[INFO] PostGIS enabled, version: {version}")
            postgis_enabled = True
    except Exception as e:
        print(f"[WARNING] PostGIS not available: {e}")
        print("[INFO] Using decimal coordinates fallback")

    # Validate database connectivity
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        print("[INFO] Database connection validated")
    except Exception as e:
        print(f"[ERROR] Database connection failed: {e}")
        raise

    return postgis_enabled


async def close_db():
    """Close database connections."""
    await engine.dispose()
