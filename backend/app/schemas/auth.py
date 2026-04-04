"""Authentication schemas for request/response validation."""

from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime
from typing import Any
from typing import Optional
from uuid import UUID


class UserBase(BaseModel):
    """Base user schema with common fields."""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr


class UserCreate(UserBase):
    """Schema for user registration."""
    password: str = Field(..., min_length=8, max_length=100)


class UserLogin(BaseModel):
    """Schema for user login."""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Schema for user response."""
    id: str
    username: str
    email: str
    subject: Optional[str] = None
    status: str
    study_duration_minutes: int
    privacy_mode: str
    show_exact_to_friends: bool
    created_at: datetime
    updated_at: datetime
    last_seen_at: datetime

    @field_validator('id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, value: Any) -> str:
        """Convert UUID to string before validation."""
        if isinstance(value, UUID):
            return str(value)
        return value

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """Schema for token response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class RefreshTokenRequest(BaseModel):
    """Schema for refresh token request."""
    refresh_token: str
