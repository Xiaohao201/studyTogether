"""Location schemas for location updates."""

from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Any, Optional
from uuid import UUID


class LocationUpdate(BaseModel):
    """Schema for location update request."""
    latitude: float = Field(..., ge=-90, le=90, description="Latitude in decimal degrees")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude in decimal degrees")


class LocationResponse(BaseModel):
    """Schema for location response."""
    id: str
    user_id: str
    latitude: float
    longitude: float
    fuzzy_latitude: Optional[float] = None
    fuzzy_longitude: Optional[float] = None
    country_code: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    created_at: datetime

    @field_validator('id', 'user_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, value: Any) -> str:
        """Convert UUID to string before validation."""
        if isinstance(value, UUID):
            return str(value)
        return value

    class Config:
        """Pydantic config."""
        from_attributes = True


class NearbyUserResponse(BaseModel):
    """Schema for nearby user with distance."""
    id: str
    username: str
    subject: Optional[str] = None
    status: str
    distance_meters: float
    location: dict
    city: Optional[str] = None
    district: Optional[str] = None

    @field_validator('id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, value: Any) -> str:
        """Convert UUID to string before validation."""
        if isinstance(value, UUID):
            return str(value)
        return value

    class Config:
        """Pydantic config."""
        from_attributes = True


class NearbyQueryParams(BaseModel):
    """Schema for nearby users query parameters."""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    radius_km: float = Field(default=5.0, ge=0.1, le=50.0, description="Search radius in kilometers")
