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
    """Initialize database (create extensions and tables).

    Production (ENVIRONMENT=production): uses Alembic migrations.
    Development: uses Base.metadata.create_all with checkfirst=True.
    """
    from sqlalchemy import text

    # Try to create PostGIS extension in a separate transaction
    postgis_enabled = False
    try:
        async with engine.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
            print("[INFO] PostGIS extension enabled successfully")

            result = await conn.execute(text("SELECT PostGIS_Version()"))
            version = result.scalar()
            print(f"[INFO] PostGIS version: {version}")
            postgis_enabled = True
    except Exception as e:
        print(f"[WARNING] PostGIS extension not available: {e}")
        print("[INFO] Location features will use decimal coordinates fallback mode")

    # Create/migrate tables
    if settings.ENVIRONMENT == "production":
        # Production: use Alembic migrations to avoid ENUM conflicts
        import subprocess
        try:
            result = subprocess.run(
                ["alembic", "upgrade", "head"],
                capture_output=True,
                text=True,
                timeout=60,
            )
            if result.returncode == 0:
                print("[INFO] Database tables initialized via Alembic migration")
            else:
                print(f"[ERROR] Alembic migration failed: {result.stderr}")
                raise RuntimeError(f"Alembic migration failed: {result.stderr}")
        except FileNotFoundError:
            print("[WARNING] Alembic not found, falling back to create_all")
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                print("[INFO] Database tables initialized via create_all (fallback)")
    else:
        # Development: use create_all (ENUM types handled gracefully)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            print("[INFO] Database tables initialized via create_all")

    return postgis_enabled


async def close_db():
    """Close database connections."""
    await engine.dispose()
