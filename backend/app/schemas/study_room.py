"""Study room Pydantic schemas."""

from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Any, Optional, List
from uuid import UUID


class StudyRoomCreate(BaseModel):
    """Schema for creating a study room."""
    target_user_id: str = Field(..., description="User ID to invite")
    subject: Optional[str] = Field(None, max_length=100, description="Study subject")
    focus_duration: int = Field(25, ge=1, le=120, description="Focus duration in minutes")
    break_duration: int = Field(5, ge=1, le=30, description="Break duration in minutes")


class StudyRoomEnd(BaseModel):
    """Schema for ending a study room."""
    room_code: str = Field(..., description="Room code to end")


class StudyRoomMessageCreate(BaseModel):
    """Schema for sending a chat message."""
    content: str = Field(..., min_length=1, max_length=2000, description="Message content")


class StudyRoomParticipantResponse(BaseModel):
    """Schema for study room participant response."""
    id: str
    study_room_id: str
    user_id: str
    username: Optional[str] = None
    joined_at: datetime
    left_at: Optional[datetime] = None

    @field_validator('id', 'study_room_id', 'user_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, value: Any) -> str:
        if isinstance(value, UUID):
            return str(value)
        return value

    class Config:
        from_attributes = True


class StudyRoomMessageResponse(BaseModel):
    """Schema for chat message response."""
    id: str
    study_room_id: str
    user_id: str
    username: Optional[str] = None
    content: str
    created_at: datetime

    @field_validator('id', 'study_room_id', 'user_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, value: Any) -> str:
        if isinstance(value, UUID):
            return str(value)
        return value

    class Config:
        from_attributes = True


class StudyRoomResponse(BaseModel):
    """Schema for study room response."""
    id: str
    room_code: str
    host_id: str
    subject: Optional[str] = None
    room_status: str
    focus_duration: int
    break_duration: int
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime
    participants: List[StudyRoomParticipantResponse] = []

    @field_validator('id', 'host_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, value: Any) -> Optional[str]:
        if isinstance(value, UUID):
            return str(value)
        if value is None:
            return None
        return value

    class Config:
        from_attributes = True


# Update forward references
StudyRoomResponse.model_rebuild()
