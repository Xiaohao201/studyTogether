"""Application configuration using Pydantic Settings."""

import os
from pydantic_settings import BaseSettings

# Removed lru_cache for development - settings reload on each call


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database - can be set directly or constructed from components
    DATABASE_URL: str | None = None

    # Database connection components (for Railway variable expansion)
    PGUSER: str | None = None
    POSTGRES_PASSWORD: str | None = None
    PGDATABASE: str | None = None
    PGHOST: str | None = None
    PGPORT: int = 5432

    # PostgreSQL host override (for Railway cross-service connection)
    POSTGRES_HOST: str | None = None

    # JWT
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

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
        """Pydantic config."""
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Ignore extra fields in .env

    def get_database_url(self) -> str:
        """Get DATABASE_URL, constructing from components if needed."""
        if self.DATABASE_URL:
            # Railway PostgreSQL uses empty username - use it as-is
            return self.DATABASE_URL

        # Construct from components
        if not all([self.POSTGRES_PASSWORD, self.PGDATABASE]):
            raise ValueError(
                "DATABASE_URL must be set, or at least POSTGRES_PASSWORD "
                "and PGDATABASE must be provided"
            )

        # Use POSTGRES_HOST, PGHOST, or fallback to localhost
        host = self.POSTGRES_HOST or self.PGHOST or "localhost"

        # Railway PostgreSQL uses 'postgres' as default username
        # Empty username (from PGUSER=None) should default to 'postgres'
        username = self.PGUSER or "postgres"

        return f"postgresql+asyncpg://{username}:{self.POSTGRES_PASSWORD}@{host}:{self.PGPORT}/{self.PGDATABASE}"


def get_settings() -> Settings:
    """Get settings instance (not cached in development)."""
    return Settings()
