"""Friendship model for friend relationships."""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Friendship(Base):
    """
    Friendship model for friend relationships.

    Each pair of users has exactly one record where the smaller UUID
    is stored in requester_id. This prevents duplicate pairs.

    Attributes:
        id: UUID primary key
        requester_id: User who sent the request (smaller UUID)
        addressee_id: User who received the request (larger UUID)
        status: pending/accepted/blocked
        created_at: Request creation timestamp
        updated_at: Last status change timestamp
    """

    __tablename__ = "friendships"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requester_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    addressee_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(String(20), nullable=False, default="pending", index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    requester = relationship(
        "User", foreign_keys=[requester_id], back_populates="friendships_sent"
    )
    addressee = relationship(
        "User", foreign_keys=[addressee_id], back_populates="friendships_received"
    )

    # Unique constraint: one record per user pair
    __table_args__ = (
        UniqueConstraint(
            "requester_id",
            "addressee_id",
            name="uq_friendship_pair",
        ),
        Index(
            "ix_friendships_pending",
            "addressee_id",
            postgresql_where=Column("status") == "pending",
        ),
    )

    def __repr__(self):
        return f"<Friendship(requester={self.requester_id}, addressee={self.addressee_id}, status={self.status})>"
