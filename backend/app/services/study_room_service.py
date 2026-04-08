"""Study room service for managing collaborative study sessions."""

import uuid
import secrets
import string
from datetime import datetime
from typing import Optional, List
from sqlalchemy import select, and_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.study_room import StudyRoom, StudyRoomParticipant, StudyRoomMessage
from app.models.user import User
from app.schemas.study_room import StudyRoomCreate


class StudyRoomService:
    """Service for study room management."""

    def __init__(self, db: AsyncSession):
        self.db = db

    def _generate_room_code(self, length: int = 8) -> str:
        """Generate a unique room code using uppercase letters and digits."""
        alphabet = string.ascii_uppercase + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(length))

    async def create_study_room(
        self,
        host_id: str,
        room_data: StudyRoomCreate
    ) -> Optional[StudyRoom]:
        """
        Create a new study room and add both participants.

        Returns:
            Created StudyRoom with participants, or None if target user not found
        """
        # Verify target user exists
        target_query = select(User).where(User.id == uuid.UUID(room_data.target_user_id))
        target_result = await self.db.execute(target_query)
        target_user = target_result.scalar_one_or_none()

        if not target_user:
            return None

        # Generate unique room code
        room_code = self._generate_room_code()
        max_attempts = 10
        for _ in range(max_attempts):
            existing_query = select(StudyRoom).where(StudyRoom.room_code == room_code)
            existing_result = await self.db.execute(existing_query)
            if existing_result.scalar_one_or_none() is None:
                break
            room_code = self._generate_room_code()
        else:
            return None

        # Create study room
        study_room = StudyRoom(
            id=uuid.uuid4(),
            room_code=room_code,
            host_id=uuid.UUID(host_id),
            subject=room_data.subject,
            room_status='waiting',
            focus_duration=room_data.focus_duration,
            break_duration=room_data.break_duration,
            created_at=datetime.utcnow(),
        )

        self.db.add(study_room)
        await self.db.flush()

        # Add host as participant
        host_participant = StudyRoomParticipant(
            id=uuid.uuid4(),
            study_room_id=study_room.id,
            user_id=uuid.UUID(host_id),
            joined_at=datetime.utcnow(),
        )
        self.db.add(host_participant)

        # Add target user as participant
        target_participant = StudyRoomParticipant(
            id=uuid.uuid4(),
            study_room_id=study_room.id,
            user_id=uuid.UUID(room_data.target_user_id),
            joined_at=datetime.utcnow(),
        )
        self.db.add(target_participant)

        await self.db.commit()
        await self.db.refresh(study_room)

        # Load relationships for response
        query = (
            select(StudyRoom)
            .where(StudyRoom.id == study_room.id)
            .options(
                selectinload(StudyRoom.participants).selectinload(StudyRoomParticipant.user)
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_study_room_by_code(self, room_code: str) -> Optional[StudyRoom]:
        """Get a study room by room code with participants loaded."""
        query = (
            select(StudyRoom)
            .where(StudyRoom.room_code == room_code)
            .options(
                selectinload(StudyRoom.participants).selectinload(StudyRoomParticipant.user)
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_study_room_by_id(self, room_id: str) -> Optional[StudyRoom]:
        """Get a study room by ID with participants loaded."""
        query = (
            select(StudyRoom)
            .where(StudyRoom.id == uuid.UUID(room_id))
            .options(
                selectinload(StudyRoom.participants).selectinload(StudyRoomParticipant.user)
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def activate_room(self, room_code: str) -> Optional[StudyRoom]:
        """Set room status to active and set started_at."""
        room = await self.get_study_room_by_code(room_code)
        if not room:
            return None

        room.room_status = 'active'
        room.started_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(room)
        return room

    async def end_study_room(self, room_code: str, user_id: str) -> Optional[StudyRoom]:
        """End a study room (host only)."""
        room = await self.get_study_room_by_code(room_code)
        if not room:
            return None

        if str(room.host_id) != user_id:
            return None

        room.room_status = 'ended'
        room.ended_at = datetime.utcnow()

        # Mark all active participants as left
        for participant in room.participants:
            if participant.left_at is None:
                participant.left_at = room.ended_at

        await self.db.commit()
        await self.db.refresh(room)
        return room

    async def leave_study_room(self, room_code: str, user_id: str) -> Optional[StudyRoomParticipant]:
        """Mark a participant as having left the room."""
        query = (
            select(StudyRoomParticipant)
            .where(
                and_(
                    StudyRoomParticipant.study_room_id == (
                        select(StudyRoom.id).where(StudyRoom.room_code == room_code)
                    ),
                    StudyRoomParticipant.user_id == uuid.UUID(user_id),
                    StudyRoomParticipant.left_at.is_(None)
                )
            )
        )
        result = await self.db.execute(query)
        participant = result.scalar_one_or_none()

        if participant:
            participant.left_at = datetime.utcnow()
            await self.db.commit()
            await self.db.refresh(participant)

        return participant

    async def get_participant_user_ids(self, room_code: str) -> List[str]:
        """Get all active (non-left) participant user IDs for a room."""
        room = await self.get_study_room_by_code(room_code)
        if not room:
            return []
        return [
            str(p.user_id)
            for p in room.participants
            if p.left_at is None
        ]

    async def is_participant(self, room_code: str, user_id: str) -> bool:
        """Check if a user is an active participant in a room."""
        room = await self.get_study_room_by_code(room_code)
        if not room:
            return False
        return any(
            str(p.user_id) == user_id and p.left_at is None
            for p in room.participants
        )

    async def save_message(
        self,
        room_code: str,
        user_id: str,
        content: str
    ) -> Optional[StudyRoomMessage]:
        """Save a chat message to the database."""
        room = await self.get_study_room_by_code(room_code)
        if not room:
            return None

        message = StudyRoomMessage(
            id=uuid.uuid4(),
            study_room_id=room.id,
            user_id=uuid.UUID(user_id),
            content=content,
            created_at=datetime.utcnow(),
        )
        self.db.add(message)
        await self.db.commit()
        await self.db.refresh(message)

        # Load user relationship for username
        query = (
            select(StudyRoomMessage)
            .where(StudyRoomMessage.id == message.id)
            .options(selectinload(StudyRoomMessage.user))
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_messages(
        self,
        room_code: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[StudyRoomMessage]:
        """Get chat messages for a room."""
        room = await self.get_study_room_by_code(room_code)
        if not room:
            return []

        query = (
            select(StudyRoomMessage)
            .where(StudyRoomMessage.study_room_id == room.id)
            .order_by(StudyRoomMessage.created_at.asc())
            .offset(offset)
            .limit(limit)
            .options(selectinload(StudyRoomMessage.user))
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())
