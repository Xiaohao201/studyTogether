"""Application configuration using Pydantic Settings."""

from pydantic_settings import BaseSettings
# Removed lru_cache for development - settings reload on each call


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    DATABASE_URL: str

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


def get_settings() -> Settings:
    """Get settings instance (not cached in development)."""
    return Settings()
