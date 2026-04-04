"""Study session schemas."""

from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Any, Optional
from uuid import UUID


class SessionCreate(BaseModel):
    """Schema for creating a study session."""
    subject: str = Field(..., min_length=1, max_length=100)


class SessionResponse(BaseModel):
    """Schema for session response."""
    id: str
    user_id: str
    subject: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    participants_count: int

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


class SessionEnd(BaseModel):
    """Schema for ending a session."""
    session_id: str
