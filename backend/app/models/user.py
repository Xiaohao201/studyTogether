"""User model for authentication and profile."""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Enum as SQLEnum, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class User(Base):
    """
    User model for authentication and profile.

    Attributes:
        id: UUID primary key
        username: Unique display name
        email: Unique email for login
        hashed_password: Bcrypt hashed password
        subject: Current study subject
        status: Current activity status (studying/break/offline)
        study_duration_minutes: Total accumulated study time
        privacy_mode: Location visibility setting (exact/fuzzy/invisible)
        show_exact_to_friends: Whether friends see exact location
        created_at: Account creation timestamp
        updated_at: Last update timestamp
        last_seen_at: Last activity timestamp
    """

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)

    # Profile
    subject = Column(String(100), nullable=True)
    status = Column(
        SQLEnum('studying', 'break', 'offline', name='user_status'),
        default='offline',
        nullable=False,
        index=True
    )
    study_duration_minutes = Column(Integer, default=0, nullable=False)

    # Privacy
    privacy_mode = Column(
        SQLEnum('exact', 'fuzzy', 'invisible', name='privacy_mode'),
        default='fuzzy',
        nullable=False
    )
    show_exact_to_friends = Column(Boolean, default=False, nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_seen_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    locations = relationship("UserLocation", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("StudySession", back_populates="user", cascade="all, delete-orphan")
    hosted_calls = relationship("CallRoom", back_populates="host", cascade="all, delete-orphan")
    call_participations = relationship("CallParticipant", back_populates="user", cascade="all, delete-orphan")
    hosted_study_rooms = relationship("StudyRoom", back_populates="host", cascade="all, delete-orphan")
    study_room_participations = relationship("StudyRoomParticipant", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(id={self.id}, username={self.username}, email={self.email})>"
