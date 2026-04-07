"""Study session service for tracking study sessions."""

import uuid
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.session import StudySession
from app.models.user import User
from app.schemas.session import SessionCreate


class SessionService:
    """Service for study session management."""

    def __init__(self, db: AsyncSession):
        """Initialize session service with database session."""
        self.db = db

    async def create_session(
        self,
        user_id: str,
        session_data: SessionCreate
    ) -> StudySession:
        """
        Create a new study session.

        Also updates user's status to 'studying' and subject to the session subject.

        Args:
            user_id: User UUID
            session_data: Session creation data (subject)

        Returns:
            Created StudySession object
        """
        session = StudySession(
            id=uuid.uuid4(),
            user_id=uuid.UUID(user_id),
            subject=session_data.subject,
            started_at=datetime.utcnow(),
            participants_count=1,
        )

        self.db.add(session)

        # Update user's status to 'studying' and set subject
        await self._update_user_status(user_id, 'studying', session_data.subject)

        await self.db.commit()
        await self.db.refresh(session)

        return session

    async def end_session(
        self,
        session_id: str,
        user_id: str
    ) -> Optional[StudySession]:
        """
        End a study session and calculate duration.

        Also updates user's status to 'offline' and updates total study time.

        Args:
            session_id: Session UUID
            user_id: User UUID (for authorization)

        Returns:
            Updated session with duration, or None if not found
        """
        query = (
            select(StudySession)
            .where(StudySession.id == uuid.UUID(session_id))
            .where(StudySession.user_id == uuid.UUID(user_id))
            .where(StudySession.ended_at.is_(None))  # Only active sessions
        )

        result = await self.db.execute(query)
        session = result.scalar_one_or_none()

        if not session:
            return None

        # End session and calculate duration
        session.ended_at = datetime.utcnow()
        duration = session.ended_at - session.started_at
        session.duration_minutes = int(duration.total_seconds() / 60)

        # Update user's status to 'offline'
        await self._update_user_status(user_id, 'offline')

        await self.db.commit()
        await self.db.refresh(session)

        # Update user's total study time
        await self._update_user_study_time(user_id, session.duration_minutes)

        return session

    async def get_session(
        self,
        session_id: str,
        user_id: str
    ) -> Optional[StudySession]:
        """
        Get a session by ID (user's own sessions only).

        Args:
            session_id: Session UUID
            user_id: User UUID

        Returns:
            Session object or None
        """
        query = (
            select(StudySession)
            .where(StudySession.id == uuid.UUID(session_id))
            .where(StudySession.user_id == uuid.UUID(user_id))
        )

        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_user_sessions(
        self,
        user_id: str,
        limit: int = 50
    ) -> List[StudySession]:
        """
        Get all sessions for a user, ordered by start time (newest first).

        Args:
            user_id: User UUID
            limit: Maximum number of sessions to return

        Returns:
            List of StudySession objects
        """
        query = (
            select(StudySession)
            .where(StudySession.user_id == uuid.UUID(user_id))
            .order_by(StudySession.started_at.desc())
            .limit(limit)
        )

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_active_session(
        self,
        user_id: str
    ) -> Optional[StudySession]:
        """
        Get user's currently active session (if any).

        Args:
            user_id: User UUID

        Returns:
            Active session or None
        """
        query = (
            select(StudySession)
            .where(StudySession.user_id == uuid.UUID(user_id))
            .where(StudySession.ended_at.is_(None))
            .order_by(StudySession.started_at.desc())
            .limit(1)
        )

        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def _update_user_study_time(
        self,
        user_id: str,
        additional_minutes: int
    ) -> None:
        """
        Update user's total study time.

        Args:
            user_id: User UUID
            additional_minutes: Minutes to add
        """
        query = (
            select(User)
            .where(User.id == uuid.UUID(user_id))
        )

        result = await self.db.execute(query)
        user = result.scalar_one_or_none()

        if user:
            user.study_duration_minutes += additional_minutes
            await self.db.commit()

    async def _update_user_status(
        self,
        user_id: str,
        status: str,
        subject: Optional[str] = None
    ) -> None:
        """
        Update user's status and optionally subject.

        Args:
            user_id: User UUID
            status: New status ('studying', 'break', 'offline')
            subject: Optional subject to set
        """
        query = (
            select(User)
            .where(User.id == uuid.UUID(user_id))
        )

        result = await self.db.execute(query)
        user = result.scalar_one_or_none()

        if user:
            user.status = status
            if subject:
                user.subject = subject
            # Don't commit here - caller will commit
