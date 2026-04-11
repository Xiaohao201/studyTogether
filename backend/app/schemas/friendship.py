"""Friendship schemas for request/response validation."""

from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Any, Optional
from uuid import UUID


class FriendRequestCreate(BaseModel):
    """Schema for sending a friend request."""
    addressee_id: str = Field(..., description="UUID of the user to send request to")


class FriendRequestAction(BaseModel):
    """Schema for accepting/rejecting a friend request."""
    pass


class FriendUserResponse(BaseModel):
    """Schema for friend user info in responses."""
    id: str
    username: str
    subject: Optional[str] = None
    status: str
    study_duration_minutes: int

    @field_validator('id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, value: Any) -> str:
        if isinstance(value, UUID):
            return str(value)
        return value

    class Config:
        from_attributes = True


class FriendshipResponse(BaseModel):
    """Schema for a friendship record."""
    id: str
    requester_id: str
    addressee_id: str
    status: str
    created_at: datetime
    updated_at: datetime
    friend: FriendUserResponse

    @field_validator('id', 'requester_id', 'addressee_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, value: Any) -> str:
        if isinstance(value, UUID):
            return str(value)
        return value

    class Config:
        from_attributes = True


class FriendRequestsResponse(BaseModel):
    """Schema for pending friend requests."""
    sent: list[FriendshipResponse]
    received: list[FriendshipResponse]


class FriendListResponse(BaseModel):
    """Schema for friend list with online status."""
    id: str
    username: str
    subject: Optional[str] = None
    status: str
    study_duration_minutes: int
    is_online: bool = False
    friendship_id: str

    @field_validator('id', 'friendship_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, value: Any) -> str:
        if isinstance(value, UUID):
            return str(value)
        return value

    class Config:
        from_attributes = True
