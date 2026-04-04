"""User schemas for profile management."""

from pydantic import BaseModel, Field, EmailStr, field_validator
from datetime import datetime
from typing import Any, Optional
from uuid import UUID


class UserUpdate(BaseModel):
    """Schema for updating user profile."""
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    subject: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field(None, pattern="^(studying|break|offline)$")
    privacy_mode: Optional[str] = Field(None, pattern="^(exact|fuzzy|invisible)$")
    show_exact_to_friends: Optional[bool] = None


class PublicUserResponse(BaseModel):
    """Schema for public user profile (excluding sensitive data)."""
    id: str
    username: str
    subject: Optional[str] = None
    status: str
    study_duration_minutes: int

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
