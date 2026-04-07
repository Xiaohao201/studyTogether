"""Call service for managing video/voice calls."""

import uuid
import secrets
import string
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy import select, and_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.call import CallRoom, CallParticipant
from app.models.user import User
from app.models.session import StudySession
from app.schemas.call import CallRoomCreate


class CallService:
    """Service for call room management."""

    def __init__(self, db: AsyncSession):
        """Initialize call service with database session."""
        self.db = db

    def _generate_room_code(self, length: int = 8) -> str:
        """
        Generate a unique room code.

        Args:
            length: Length of room code (default 8)

        Returns:
            Unique room code string
        """
        alphabet = string.ascii_uppercase + string.digits
        while True:
            code = ''.join(secrets.choice(alphabet) for _ in range(length))
            # Check if code already exists (we'll verify in DB transaction)
            return code

    async def create_call_room(
        self,
        host_id: str,
        call_data: CallRoomCreate
    ) -> Optional[CallRoom]:
        """
        Create a new call room and add both participants.

        Args:
            host_id: Host user UUID
            call_data: Call creation data (target_user_id, call_type)

        Returns:
            Created CallRoom object with participants, or None if target user not found
        """
        # Verify target user exists
        target_query = select(User).where(User.id == uuid.UUID(call_data.target_user_id))
        target_result = await self.db.execute(target_query)
        target_user = target_result.scalar_one_or_none()

        if not target_user:
            return None

        # Generate unique room code
        room_code = self._generate_room_code()

        # Ensure room code is unique
        max_attempts = 10
        for _ in range(max_attempts):
            existing_query = select(CallRoom).where(CallRoom.room_code == room_code)
            existing_result = await self.db.execute(existing_query)
            if existing_result.scalar_one_or_none() is None:
                break
            room_code = self._generate_room_code()
        else:
            # Could not generate unique code
            return None

        # Create call room
        call_room = CallRoom(
            id=uuid.uuid4(),
            room_code=room_code,
            host_id=uuid.UUID(host_id),
            call_type=call_data.call_type,
            call_status='initiated',
            started_at=datetime.utcnow(),
        )

        self.db.add(call_room)
        await self.db.flush()  # Get the ID

        # Add host as participant
        host_participant = CallParticipant(
            id=uuid.uuid4(),
            call_room_id=call_room.id,
            user_id=uuid.UUID(host_id),
            joined_at=datetime.utcnow(),
            has_video=(call_data.call_type == 'video'),
            has_audio=True,
        )
        self.db.add(host_participant)

        # Add target user as participant (they haven't joined yet, but we reserve their spot)
        target_participant = CallParticipant(
            id=uuid.uuid4(),
            call_room_id=call_room.id,
            user_id=uuid.UUID(call_data.target_user_id),
            joined_at=datetime.utcnow(),
            has_video=(call_data.call_type == 'video'),
            has_audio=True,
        )
        self.db.add(target_participant)

        await self.db.commit()
        await self.db.refresh(call_room)

        # Load participants for response
        participants_query = select(CallParticipant).where(
            CallParticipant.call_room_id == call_room.id
        )
        participants_result = await self.db.execute(participants_query)
        call_room.participants = list(participants_result.scalars().all())

        return call_room

    async def get_call_room_by_code(
        self,
        room_code: str
    ) -> Optional[CallRoom]:
        """
        Get a call room by room code.

        Args:
            room_code: Room code

        Returns:
            CallRoom object with participants, or None
        """
        query = (
            select(CallRoom)
            .where(CallRoom.room_code == room_code)
            .options(selectinload(CallRoom.participants))
        )

        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_call_room_by_id(
        self,
        room_id: str
    ) -> Optional[CallRoom]:
        """
        Get a call room by ID.

        Args:
            room_id: Room UUID

        Returns:
            CallRoom object with participants, or None
        """
        query = (
            select(CallRoom)
            .where(CallRoom.id == uuid.UUID(room_id))
            .options(selectinload(CallRoom.participants))
        )

        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def update_call_status(
        self,
        room_id: str,
        status: str
    ) -> Optional[CallRoom]:
        """
        Update call room status.

        Args:
            room_id: Room UUID
            status: New status ('ongoing', 'ended', 'rejected')

        Returns:
            Updated CallRoom object, or None
        """
        query = (
            update(CallRoom)
            .where(CallRoom.id == uuid.UUID(room_id))
            .values(call_status=status)
            .returning(CallRoom)
        )

        result = await self.db.execute(query)
        call_room = result.scalar_one_or_none()

        if call_room:
            await self.db.commit()
            await self.db.refresh(call_room)

        return call_room

    async def update_participant_media(
        self,
        room_id: str,
        user_id: str,
        has_video: Optional[bool] = None,
        has_audio: Optional[bool] = None
    ) -> Optional[CallParticipant]:
        """
        Update participant's media state.

        Args:
            room_id: Room UUID
            user_id: User UUID
            has_video: Whether video is enabled
            has_audio: Whether audio is enabled

        Returns:
            Updated CallParticipant object, or None
        """
        update_values = {}
        if has_video is not None:
            update_values['has_video'] = has_video
        if has_audio is not None:
            update_values['has_audio'] = has_audio

        if not update_values:
            return None

        query = (
            update(CallParticipant)
            .where(
                and_(
                    CallParticipant.call_room_id == uuid.UUID(room_id),
                    CallParticipant.user_id == uuid.UUID(user_id),
                    CallParticipant.left_at.is_(None)
                )
            )
            .values(**update_values)
            .returning(CallParticipant)
        )

        result = await self.db.execute(query)
        participant = result.scalar_one_or_none()

        if participant:
            await self.db.commit()
            await self.db.refresh(participant)

        return participant

    async def end_call(
        self,
        room_id: str,
        user_id: str
    ) -> Optional[CallRoom]:
        """
        End a call and calculate duration.

        Args:
            room_id: Room UUID
            user_id: User UUID (for authorization - any participant can end)

        Returns:
            Updated CallRoom with duration, or None if not found
        """
        query = select(CallRoom).where(CallRoom.id == uuid.UUID(room_id))
        result = await self.db.execute(query)
        call_room = result.scalar_one_or_none()

        if not call_room:
            return None

        # Only update if not already ended
        if call_room.ended_at is None:
            call_room.ended_at = datetime.utcnow()
            duration = call_room.ended_at - call_room.started_at
            call_room.duration_seconds = int(duration.total_seconds())
            call_room.call_status = 'ended'

            # Mark all participants as having left
            participants_query = select(CallParticipant).where(
                and_(
                    CallParticipant.call_room_id == call_room.id,
                    CallParticipant.left_at.is_(None)
                )
            )
            participants_result = await self.db.execute(participants_query)
            participants = list(participants_result.scalars().all())

            for participant in participants:
                participant.left_at = call_room.ended_at

            await self.db.commit()
            await self.db.refresh(call_room)

        return call_room

    async def get_user_active_calls(
        self,
        user_id: str,
        limit: int = 10
    ) -> List[CallRoom]:
        """
        Get user's active/ongoing calls.

        Args:
            user_id: User UUID
            limit: Maximum number of calls to return

        Returns:
            List of CallRoom objects
        """
        query = (
            select(CallRoom)
            .join(CallParticipant, CallParticipant.call_room_id == CallRoom.id)
            .where(
                and_(
                    CallParticipant.user_id == uuid.UUID(user_id),
                    CallRoom.call_status.in_(['initiated', 'ongoing'])
                )
            )
            .order_by(CallRoom.started_at.desc())
            .limit(limit)
            .options(selectinload(CallRoom.participants))
        )

        result = await self.db.execute(query)
        return list(result.scalars().all())
