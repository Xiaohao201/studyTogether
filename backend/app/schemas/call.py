"""Call room and participant schemas."""

from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Any, Optional, List
from uuid import UUID


class CallRoomCreate(BaseModel):
    """Schema for creating a call room."""
    target_user_id: str = Field(..., description="User ID to call")
    call_type: str = Field(..., pattern="^(voice|video)$", description="Type of call: 'voice' or 'video'")


class CallRoomResponse(BaseModel):
    """Schema for call room response."""
    id: str
    room_code: str
    host_id: str
    call_type: str
    call_status: str
    study_session_id: Optional[str] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    participants: List['CallParticipantResponse'] = []

    @field_validator('id', 'host_id', 'study_session_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, value: Any) -> Optional[str]:
        """Convert UUID to string before validation."""
        if isinstance(value, UUID):
            return str(value)
        if value is None:
            return None
        return value

    class Config:
        """Pydantic config."""
        from_attributes = True


class CallParticipantResponse(BaseModel):
    """Schema for call participant response."""
    id: str
    call_room_id: str
    user_id: str
    joined_at: datetime
    left_at: Optional[datetime] = None
    has_video: bool
    has_audio: bool

    @field_validator('id', 'call_room_id', 'user_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, value: Any) -> str:
        """Convert UUID to string before validation."""
        if isinstance(value, UUID):
            return str(value)
        return value

    class Config:
        """Pydantic config."""
        from_attributes = True


class CallEnd(BaseModel):
    """Schema for ending a call."""
    room_id: str


# Update forward references
CallRoomResponse.model_rebuild()
