"""Database configuration and session management."""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import MetaData
from typing import AsyncGenerator

from app.core.config import get_settings

settings = get_settings()

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
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
    import asyncio

    async with engine.begin() as conn:
        # Check if PostGIS is available
        try:
            # Try to create PostGIS extension
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
            await conn.commit()
            print("[INFO] ✓ PostGIS extension enabled successfully")

            # Verify PostGIS is working
            result = await conn.execute(text("SELECT PostGIS_Version()"))
            version = result.scalar()
            print(f"[INFO] ✓ PostGIS version: {version}")

        except Exception as e:
            print(f"[WARNING] PostGIS extension not available: {e}")
            print("[WARNING] Location features will use fallback mode (decimal coordinates)")
            print("[INFO] You can enable PostGIS by running: CREATE EXTENSION postgis;")

        # Create tables (PostGIS columns will be nullable if extension is missing)
        await conn.run_sync(Base.metadata.create_all)
        print("[INFO] ✓ Database tables initialized")


async def close_db():
    """Close database connections."""
    await engine.dispose()
