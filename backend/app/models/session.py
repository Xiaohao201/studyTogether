"""StudySession model for tracking study sessions."""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class StudySession(Base):
    """
    Study session model for tracking user study activities.

    Attributes:
        id: UUID primary key
        user_id: Foreign key to users table
        subject: Study subject/topic
        started_at: Session start timestamp
        ended_at: Session end timestamp (null if ongoing)
        duration_minutes: Calculated session duration in minutes
        participants_count: Number of participants (for future group sessions)
        created_at: Record creation timestamp
    """

    __tablename__ = "study_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Session details
    subject = Column(String(100), nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    ended_at = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, nullable=True)

    # Social features (for future group sessions)
    participants_count = Column(Integer, default=1, nullable=False)

    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="sessions")

    def __repr__(self):
        return f"<StudySession(id={self.id}, user_id={self.user_id}, subject={self.subject}, started={self.started_at})>"
