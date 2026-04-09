"""Socket.io event handlers for WebRTC signaling."""

import logging
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.socket import connected_users, sio
from app.services.call_service import CallService
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def get_db() -> AsyncSession:
    """Get database session."""
    async with AsyncSessionLocal() as session:
        yield session


def get_user_sid(user_id: str) -> Optional[str]:
    """
    Get socket session ID for a user.

    Args:
        user_id: User UUID

    Returns:
        Socket session ID or None
    """
    for sid, uid in connected_users.items():
        if uid == user_id:
            return sid
    return None


@sio.event
async def call_offer(sid: str, data: Dict[str, Any]):
    """
    Handle WebRTC offer from caller.

    Args:
        sid: Caller's socket session ID
        data: { targetUserId, roomCode, offer (SDP) }
    """
    try:
        caller_id = connected_users.get(sid)
        if not caller_id:
            logger.warning(f"[Call] call_offer from unauthenticated socket: {sid}")
            return

        target_user_id = data.get('targetUserId')
        room_code = data.get('roomCode')
        offer = data.get('offer')
        call_type = data.get('callType', 'voice')

        if not target_user_id or not room_code or not offer:
            logger.warning(f"[Call] Invalid call_offer data: {data}")
            return

        # Find target user's socket
        target_sid = get_user_sid(target_user_id)
        if not target_sid:
            logger.warning(f"[Call] Target user {target_user_id} not connected")
            # Notify caller that target is offline
            await sio.emit(
                'call-user-unavailable',
                {'roomCode': room_code, 'userId': target_user_id},
                to=sid
            )
            return

        # Forward offer to target user with call type
        await sio.emit(
            'incoming-call-offer',
            {
                'callerId': caller_id,
                'roomCode': room_code,
                'callType': call_type,
                'offer': offer
            },
            to=target_sid
        )

        logger.info(f"[Call] Forwarded offer from {caller_id} to {target_user_id}")

    except Exception as e:
        logger.error(f"[Call] Error handling call_offer: {e}")


@sio.event
async def call_answer(sid: str, data: Dict[str, Any]):
    """
    Handle WebRTC answer from callee.

    Args:
        sid: Callee's socket session ID
        data: { callerId, roomCode, answer (SDP) }
    """
    try:
        callee_id = connected_users.get(sid)
        if not callee_id:
            logger.warning(f"[Call] call_answer from unauthenticated socket: {sid}")
            return

        caller_id = data.get('callerId')
        room_code = data.get('roomCode')
        answer = data.get('answer')

        if not caller_id or not room_code or not answer:
            logger.warning(f"[Call] Invalid call_answer data: {data}")
            return

        # Update call status to 'ongoing'
        async for db in get_db():
            call_service = CallService(db)
            call_room = await call_service.get_call_room_by_code(room_code)
            if call_room and call_room.call_status == 'initiated':
                await call_service.update_call_status(str(call_room.id), 'ongoing')

        # Find caller's socket
        caller_sid = get_user_sid(caller_id)
        if not caller_sid:
            logger.warning(f"[Call] Caller {caller_id} not connected")
            return

        # Forward answer to caller
        await sio.emit(
            'call-answered',
            {
                'calleeId': callee_id,
                'roomCode': room_code,
                'answer': answer
            },
            to=caller_sid
        )

        logger.info(f"[Call] Forwarded answer from {callee_id} to {caller_id}")

    except Exception as e:
        logger.error(f"[Call] Error handling call_answer: {e}")


@sio.event
async def ice_candidate(sid: str, data: Dict[str, Any]):
    """
    Handle ICE candidate for WebRTC connection.

    Args:
        sid: Sender's socket session ID
        data: { targetUserId, candidate }
    """
    try:
        sender_id = connected_users.get(sid)
        if not sender_id:
            logger.warning(f"[Call] ice_candidate from unauthenticated socket: {sid}")
            return

        target_user_id = data.get('targetUserId')
        candidate = data.get('candidate')

        if not target_user_id or not candidate:
            logger.warning(f"[Call] Invalid ice_candidate data: {data}")
            return

        # Find target user's socket
        target_sid = get_user_sid(target_user_id)
        if not target_sid:
            logger.warning(f"[Call] Target user {target_user_id} not connected for ICE")
            return

        # Forward ICE candidate
        await sio.emit(
            'ice-candidate',
            {
                'senderId': sender_id,
                'candidate': candidate
            },
            to=target_sid
        )

    except Exception as e:
        logger.error(f"[Call] Error handling ice_candidate: {e}")


@sio.event
async def call_reject(sid: str, data: Dict[str, Any]):
    """
    Handle call rejection from callee.

    Args:
        sid: Callee's socket session ID
        data: { callerId, roomCode }
    """
    try:
        callee_id = connected_users.get(sid)
        if not callee_id:
            logger.warning(f"[Call] call_reject from unauthenticated socket: {sid}")
            return

        caller_id = data.get('callerId')
        room_code = data.get('roomCode')

        if not caller_id or not room_code:
            logger.warning(f"[Call] Invalid call_reject data: {data}")
            return

        # Update call status in database
        async for db in get_db():
            call_service = CallService(db)
            call_room = await call_service.get_call_room_by_code(room_code)
            if call_room:
                await call_service.update_call_status(str(call_room.id), 'rejected')

        # Notify caller
        caller_sid = get_user_sid(caller_id)
        if caller_sid:
            await sio.emit(
                'call-rejected',
                {
                    'calleeId': callee_id,
                    'roomCode': room_code
                },
                to=caller_sid
            )

        logger.info(f"[Call] Call rejected by {callee_id} for {caller_id}")

    except Exception as e:
        logger.error(f"[Call] Error handling call_reject: {e}")


@sio.event
async def call_ended(sid: str, data: Dict[str, Any]):
    """
    Handle call ended event.

    Args:
        sid: Sender's socket session ID
        data: { roomCode, userId }
    """
    try:
        user_id = connected_users.get(sid)
        if not user_id:
            logger.warning(f"[Call] call_ended from unauthenticated socket: {sid}")
            return

        room_code = data.get('roomCode')

        if not room_code:
            logger.warning(f"[Call] Invalid call_ended data: {data}")
            return

        # Update call status in database
        async for db in get_db():
            call_service = CallService(db)
            call_room = await call_service.get_call_room_by_code(room_code)
            if call_room:
                await call_service.end_call(str(call_room.id), user_id)

                # Notify all participants in the room
                for participant in call_room.participants:
                    if str(participant.user_id) != user_id:
                        participant_sid = get_user_sid(str(participant.user_id))
                        if participant_sid:
                            await sio.emit(
                                'call-ended',
                                {
                                    'roomCode': room_code,
                                    'endedBy': user_id
                                },
                                to=participant_sid
                            )

        logger.info(f"[Call] Call ended for room {room_code} by {user_id}")

    except Exception as e:
        logger.error(f"[Call] Error handling call_ended: {e}")


@sio.event
async def media_toggle(sid: str, data: Dict[str, Any]):
    """
    Handle media toggle (audio/video on/off).

    Args:
        sid: Sender's socket session ID
        data: { roomCode, hasAudio, hasVideo }
    """
    try:
        user_id = connected_users.get(sid)
        if not user_id:
            logger.warning(f"[Call] media_toggle from unauthenticated socket: {sid}")
            return

        room_code = data.get('roomCode')
        has_audio = data.get('hasAudio')
        has_video = data.get('hasVideo')

        if not room_code:
            logger.warning(f"[Call] Invalid media_toggle data: {data}")
            return

        # Update in database
        async for db in get_db():
            call_service = CallService(db)
            call_room = await call_service.get_call_room_by_code(room_code)
            if call_room:
                await call_service.update_participant_media(
                    str(call_room.id),
                    user_id,
                    has_video=has_video,
                    has_audio=has_audio
                )

                # Notify other participants
                for participant in call_room.participants:
                    if str(participant.user_id) != user_id:
                        participant_sid = get_user_sid(str(participant.user_id))
                        if participant_sid:
                            await sio.emit(
                                'participant-media-changed',
                                {
                                    'userId': user_id,
                                    'hasAudio': has_audio,
                                    'hasVideo': has_video
                                },
                                to=participant_sid
                            )

    except Exception as e:
        logger.error(f"[Call] Error handling media_toggle: {e}")


def register_call_handlers():
    """Register all call-related Socket.io event handlers."""
    # Handlers are registered via @sio.event decorators
    logger.info("[Call] WebRTC signaling handlers registered")
