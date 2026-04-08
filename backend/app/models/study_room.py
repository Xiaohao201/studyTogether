"""Study room models for collaborative study sessions."""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class StudyRoom(Base):
    """
    Study room model for collaborative study sessions with Pomodoro timer.

    Attributes:
        id: UUID primary key
        room_code: Unique room code for joining
        host_id: Foreign key to users table (room creator)
        subject: Study subject for this room
        room_status: Current status ('waiting', 'active', 'ended')
        focus_duration: Focus phase duration in minutes (default 25)
        break_duration: Break phase duration in minutes (default 5)
        started_at: Room start timestamp
        ended_at: Room end timestamp
        created_at: Room creation timestamp
    """

    __tablename__ = "study_rooms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_code = Column(String(20), nullable=False, unique=True, index=True)
    host_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    subject = Column(String(100), nullable=True)
    room_status = Column(
        String(20),
        nullable=False,
        default='waiting',
        index=True
    )

    # Pomodoro settings
    focus_duration = Column(Integer, nullable=False, default=25)
    break_duration = Column(Integer, nullable=False, default=5)

    # Timestamps
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    host = relationship("User", back_populates="hosted_study_rooms")
    participants = relationship(
        "StudyRoomParticipant",
        back_populates="study_room",
        cascade="all, delete-orphan"
    )
    messages = relationship(
        "StudyRoomMessage",
        back_populates="study_room",
        cascade="all, delete-orphan",
        order_by="StudyRoomMessage.created_at"
    )

    def __repr__(self):
        return f"<StudyRoom(id={self.id}, room_code={self.room_code}, status={self.room_status})>"


class StudyRoomParticipant(Base):
    """
    Study room participant model.

    Attributes:
        id: UUID primary key
        study_room_id: Foreign key to study_rooms table
        user_id: Foreign key to users table
        joined_at: When the participant joined
        left_at: When the participant left
    """

    __tablename__ = "study_room_participants"
    __table_args__ = (
        UniqueConstraint('study_room_id', 'user_id', name='uq_study_room_participant'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    study_room_id = Column(
        UUID(as_uuid=True),
        ForeignKey("study_rooms.id", ondelete="CASCADE"),
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

    # Relationships
    study_room = relationship("StudyRoom", back_populates="participants")
    user = relationship("User", back_populates="study_room_participations")

    def __repr__(self):
        return f"<StudyRoomParticipant(id={self.id}, room={self.study_room_id}, user={self.user_id})>"


class StudyRoomMessage(Base):
    """
    Study room chat message model.

    Attributes:
        id: UUID primary key
        study_room_id: Foreign key to study_rooms table
        user_id: Foreign key to users table
        content: Message text content
        created_at: Message creation timestamp
    """

    __tablename__ = "study_room_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    study_room_id = Column(
        UUID(as_uuid=True),
        ForeignKey("study_rooms.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    content = Column(Text, nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    study_room = relationship("StudyRoom", back_populates="messages")
    user = relationship("User")

    def __repr__(self):
        return f"<StudyRoomMessage(id={self.id}, room={self.study_room_id})>"
