"""Socket.io server initialization and configuration."""

import logging
from typing import Dict, Any
from socketio import AsyncServer

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Create Socket.io async server
sio = AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=settings.DEBUG,
    engineio_logger=settings.DEBUG,
)

# Store connected user IDs by socket session ID
connected_users: Dict[str, str] = {}


async def authenticate_socket(token: str) -> str | None:
    """
    Authenticate Socket.io connection using JWT token.

    Args:
        token: JWT access token

    Returns:
        User ID if authenticated, None otherwise
    """
    from app.core.security import decode_token

    payload = decode_token(token)
    if payload is None:
        return None

    return payload.get("sub")


@sio.event
async def connect(sid, environ, auth):
    """
    Handle client connection.

    Args:
        sid: Socket session ID
        environ: WSGI environ dict
        auth: Authentication data (should contain token)
    """
    try:
        token = auth.get('token') if auth else None
        if not token:
            # Also check query param
            query_string = environ.get('QUERY_STRING', '')
            if 'token=' in query_string:
                token = query_string.split('token=')[1].split('&')[0]

        if not token:
            logger.warning(f"[Socket] Connection rejected: No token provided (sid={sid})")
            return False

        user_id = await authenticate_socket(token)
        if not user_id:
            logger.warning(f"[Socket] Connection rejected: Invalid token (sid={sid})")
            return False

        # Store user mapping
        connected_users[sid] = user_id
        logger.info(f"[Socket] User {user_id} connected (sid={sid})")

        # Broadcast friend online status
        try:
            from app.socket.friend_handler import handle_friend_connect
            await handle_friend_connect(user_id)
        except Exception as e:
            logger.error(f"[Socket] Error broadcasting friend online status: {e}")

        return True

    except Exception as e:
        logger.error(f"[Socket] Connection error: {e}")
        return False


@sio.event
async def disconnect(sid):
    """
    Handle client disconnection.

    Notifies study room participants when a user disconnects.

    Args:
        sid: Socket session ID
    """
    user_id = connected_users.pop(sid, None)
    if user_id:
        logger.info(f"[Socket] User {user_id} disconnected (sid={sid})")

        # Broadcast friend offline status
        try:
            from app.socket.friend_handler import handle_friend_disconnect
            await handle_friend_disconnect(user_id)
        except Exception as e:
            logger.error(f"[Socket] Error broadcasting friend offline status: {e}")

        # Notify study room participants about disconnect
        try:
            import uuid as uuid_mod
            from app.services.study_room_service import StudyRoomService
            from app.core.database import AsyncSessionLocal
            from sqlalchemy import select, and_
            from app.models.study_room import StudyRoom, StudyRoomParticipant

            async with AsyncSessionLocal() as db:
                service = StudyRoomService(db)
                active_participations = await db.execute(
                    select(StudyRoomParticipant)
                    .join(StudyRoom)
                    .where(
                        and_(
                            StudyRoomParticipant.user_id == uuid_mod.UUID(user_id),
                            StudyRoomParticipant.left_at.is_(None),
                            StudyRoom.room_status.in_(['active', 'waiting']),
                        )
                    )
                )
                participations = active_participations.scalars().all()

                for participation in participations:
                    room_result = await db.execute(
                        select(StudyRoom).where(StudyRoom.id == participation.study_room_id)
                    )
                    room = room_result.scalar_one_or_none()
                    if not room:
                        continue

                    # Get other participants
                    p_user_ids = await service.get_participant_user_ids(room.room_code)
                    for uid in p_user_ids:
                        if uid != str(user_id):
                            other_sid = None
                            for s, u in connected_users.items():
                                if u == uid:
                                    other_sid = s
                                    break
                            if other_sid:
                                await sio.emit('study-room-participant-disconnected', {
                                    'roomCode': room.room_code,
                                    'userId': str(user_id),
                                }, to=other_sid)

        except Exception as e:
            logger.error(f"[Socket] Error notifying study room participants on disconnect: {e}")


def get_socket_app() -> AsyncServer:
    """Get the Socket.io server instance."""
    return sio
