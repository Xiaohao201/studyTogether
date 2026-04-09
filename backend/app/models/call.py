"""Call room and participant models for video/voice calling."""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class CallRoom(Base):
    """
    Call room model for video/voice calls.
    """

    __tablename__ = "call_rooms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_code = Column(String(20), nullable=False, unique=True, index=True)
    host_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Call details - use String instead of ENUM to avoid migration issues
    call_type = Column(String(10), nullable=False)
    call_status = Column(String(20), nullable=False, default='initiated', index=True)

    # Optional link to study session
    study_session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("study_sessions.id", ondelete="SET NULL"),
        nullable=True
    )

    # Timestamps
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    ended_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=True)

    # Relationships
    host = relationship("User", back_populates="hosted_calls")
    study_session = relationship("StudySession")
    participants = relationship(
        "CallParticipant",
        back_populates="call_room",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<CallRoom(id={self.id}, room_code={self.room_code}, call_type={self.call_type}, status={self.call_status})>"


class CallParticipant(Base):
    """
    Call participant model for tracking who is in a call.
    """

    __tablename__ = "call_participants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    call_room_id = Column(
        UUID(as_uuid=True),
        ForeignKey("call_rooms.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Timestamps
    joined_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    left_at = Column(DateTime, nullable=True)

    # Media state
    has_video = Column(Boolean, nullable=False, default=True)
    has_audio = Column(Boolean, nullable=False, default=True)

    # Relationships
    call_room = relationship("CallRoom", back_populates="participants")
    user = relationship("User", back_populates="call_participations")

    def __repr__(self):
        return f"<CallParticipant(id={self.id}, call_room_id={self.call_room_id}, user_id={self.user_id})>"
