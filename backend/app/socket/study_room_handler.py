"""Socket.io event handlers for study room collaboration and Pomodoro timer."""

import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime

from app.socket import connected_users, sio
from app.services.study_room_service import StudyRoomService
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

# In-memory timer state per room: { room_code: TimerState }
_timer_states: Dict[str, Dict[str, Any]] = {}

# Background timer tasks per room: { room_code: asyncio.Task }
_timer_tasks: Dict[str, asyncio.Task] = {}


def get_user_sid(user_id: str) -> Optional[str]:
    """Get socket session ID for a user."""
    for sid, uid in connected_users.items():
        if uid == user_id:
            return sid
    return None


async def _broadcast_timer_state(room_code: str) -> None:
    """Broadcast current timer state to all participants in a room."""
    timer_state = _timer_states.get(room_code)
    if not timer_state:
        return

    async with AsyncSessionLocal() as db:
        service = StudyRoomService(db)
        user_ids = await service.get_participant_user_ids(room_code)

    for uid in user_ids:
        sid = get_user_sid(uid)
        if sid:
            await sio.emit('timer-state', timer_state, to=sid)


async def _timer_tick(room_code: str) -> None:
    """Background task that ticks the Pomodoro timer every second."""
    try:
        while room_code in _timer_states:
            state = _timer_states[room_code]
            if state.get('isPaused', False):
                await asyncio.sleep(1)
                continue

            remaining = state.get('remainingSeconds', 0)
            if remaining <= 0:
                # Phase complete — auto-switch
                current_phase = state.get('phase', 'focus')
                async with AsyncSessionLocal() as db:
                    service = StudyRoomService(db)
                    room = await service.get_study_room_by_code(room_code)
                    user_ids = await service.get_participant_user_ids(room_code)

                if current_phase == 'focus':
                    new_phase = 'break'
                    new_duration = room.break_duration if room else 5
                else:
                    new_phase = 'focus'
                    new_duration = room.focus_duration if room else 25

                state['phase'] = new_phase
                state['remainingSeconds'] = new_duration * 60
                state['phaseChangedAt'] = datetime.utcnow().isoformat()

                # Broadcast phase change
                await _broadcast_timer_state(room_code)

                # Send explicit phase-changed event
                for uid in user_ids:
                    sid = get_user_sid(uid)
                    if sid:
                        await sio.emit('timer-phase-changed', {
                            'roomCode': room_code,
                            'phase': new_phase,
                            'remainingSeconds': state['remainingSeconds'],
                        }, to=sid)
            else:
                state['remainingSeconds'] = remaining - 1

                # Broadcast every 5 seconds for sync
                if state['remainingSeconds'] % 5 == 0:
                    await _broadcast_timer_state(room_code)

            await asyncio.sleep(1)

    except asyncio.CancelledError:
        logger.info(f"[StudyRoom] Timer task cancelled for room {room_code}")
    except Exception as e:
        logger.error(f"[StudyRoom] Timer task error for room {room_code}: {e}")


def _start_timer_task(room_code: str) -> None:
    """Start the background timer task for a room if not already running."""
    if room_code not in _timer_tasks or _timer_tasks[room_code].done():
        _timer_tasks[room_code] = asyncio.create_task(_timer_tick(room_code))


def _stop_timer_task(room_code: str) -> None:
    """Stop the background timer task for a room."""
    task = _timer_tasks.pop(room_code, None)
    if task and not task.done():
        task.cancel()
    _timer_states.pop(room_code, None)


@sio.event
async def study_room_invite(sid: str, data: Dict[str, Any]):
    """Handle study room invitation. Sent after REST creates the room."""
    try:
        inviter_id = connected_users.get(sid)
        if not inviter_id:
            return

        target_user_id = data.get('targetUserId')
        room_code = data.get('roomCode')
        subject = data.get('subject')
        inviter_username = data.get('inviterUsername', '')

        if not target_user_id or not room_code:
            logger.warning(f"[StudyRoom] Invalid invite data from {sid}")
            return

        target_sid = get_user_sid(target_user_id)
        if not target_sid:
            logger.warning(f"[StudyRoom] Target user {target_user_id} not connected for invite")
            await sio.emit('study-invite-failed', {
                'roomCode': room_code,
                'reason': 'User offline',
            }, to=sid)
            return

        await sio.emit('incoming-study-invite', {
            'inviterId': inviter_id,
            'inviterUsername': inviter_username,
            'roomCode': room_code,
            'subject': subject,
        }, to=target_sid)

        logger.info(f"[StudyRoom] Invite sent from {inviter_id} to {target_user_id} for room {room_code}")

    except Exception as e:
        logger.error(f"[StudyRoom] Error handling invite: {e}")


@sio.event
async def study_room_accept(sid: str, data: Dict[str, Any]):
    """Handle study room invite acceptance."""
    try:
        accepter_id = connected_users.get(sid)
        if not accepter_id:
            return

        room_code = data.get('roomCode')
        inviter_id = data.get('inviterId')

        if not room_code or not inviter_id:
            return

        # Activate the room (status -> active)
        async with AsyncSessionLocal() as db:
            service = StudyRoomService(db)
            room = await service.activate_room(room_code)

        # Initialize timer state for this room
        focus_duration = room.focus_duration if room else 25
        _timer_states[room_code] = {
            'roomCode': room_code,
            'phase': 'focus',
            'remainingSeconds': focus_duration * 60,
            'isPaused': True,
            'phaseChangedAt': datetime.utcnow().isoformat(),
        }

        # Notify inviter that invite was accepted
        inviter_sid = get_user_sid(inviter_id)
        if inviter_sid:
            await sio.emit('study-invite-accepted', {
                'roomCode': room_code,
                'accepterId': accepter_id,
            }, to=inviter_sid)

        # Notify accepter they joined
        await sio.emit('study-room-joined', {
            'roomCode': room_code,
        }, to=sid)

        logger.info(f"[StudyRoom] User {accepter_id} accepted invite for room {room_code}")

    except Exception as e:
        logger.error(f"[StudyRoom] Error handling accept: {e}")


@sio.event
async def study_room_reject(sid: str, data: Dict[str, Any]):
    """Handle study room invite rejection."""
    try:
        rejecter_id = connected_users.get(sid)
        if not rejecter_id:
            return

        room_code = data.get('roomCode')
        inviter_id = data.get('inviterId')

        if not room_code or not inviter_id:
            return

        # Notify inviter
        inviter_sid = get_user_sid(inviter_id)
        if inviter_sid:
            await sio.emit('study-invite-rejected', {
                'roomCode': room_code,
                'rejecterId': rejecter_id,
            }, to=inviter_sid)

        logger.info(f"[StudyRoom] User {rejecter_id} rejected invite for room {room_code}")

    except Exception as e:
        logger.error(f"[StudyRoom] Error handling reject: {e}")


@sio.event
async def study_room_join(sid: str, data: Dict[str, Any]):
    """Handle user joining a study room page."""
    try:
        user_id = connected_users.get(sid)
        if not user_id:
            return

        room_code = data.get('roomCode')
        if not room_code:
            return

        # Verify participant
        async with AsyncSessionLocal() as db:
            service = StudyRoomService(db)
            is_member = await service.is_participant(room_code, user_id)

        if not is_member:
            logger.warning(f"[StudyRoom] Non-member {user_id} tried to join room {room_code}")
            return

        # Send current timer state to the joining user
        timer_state = _timer_states.get(room_code)
        if timer_state:
            await sio.emit('timer-state', timer_state, to=sid)

        logger.info(f"[StudyRoom] User {user_id} joined room {room_code}")

    except Exception as e:
        logger.error(f"[StudyRoom] Error handling join: {e}")


@sio.event
async def study_room_leave(sid: str, data: Dict[str, Any]):
    """Handle user leaving a study room."""
    try:
        user_id = connected_users.get(sid)
        if not user_id:
            return

        room_code = data.get('roomCode')
        if not room_code:
            return

        # Update participant in database
        async with AsyncSessionLocal() as db:
            service = StudyRoomService(db)
            await service.leave_study_room(room_code, user_id)
            user_ids = await service.get_participant_user_ids(room_code)

        # Notify other participants
        for uid in user_ids:
            participant_sid = get_user_sid(uid)
            if participant_sid:
                await sio.emit('study-room-left', {
                    'roomCode': room_code,
                    'userId': user_id,
                }, to=participant_sid)

        logger.info(f"[StudyRoom] User {user_id} left room {room_code}")

    except Exception as e:
        logger.error(f"[StudyRoom] Error handling leave: {e}")


@sio.event
async def study_room_end(sid: str, data: Dict[str, Any]):
    """Handle host ending a study room."""
    try:
        user_id = connected_users.get(sid)
        if not user_id:
            return

        room_code = data.get('roomCode')
        if not room_code:
            return

        # End room in database (verifies host)
        async with AsyncSessionLocal() as db:
            service = StudyRoomService(db)
            room = await service.end_study_room(room_code, user_id)

        if not room:
            logger.warning(f"[StudyRoom] User {user_id} failed to end room {room_code}")
            return

        # Stop timer
        _stop_timer_task(room_code)

        # Notify all participants
        all_user_ids = [str(p.user_id) for p in room.participants]
        for uid in all_user_ids:
            participant_sid = get_user_sid(uid)
            if participant_sid:
                await sio.emit('study-room-ended', {
                    'roomCode': room_code,
                    'endedBy': user_id,
                }, to=participant_sid)

        logger.info(f"[StudyRoom] Room {room_code} ended by {user_id}")

    except Exception as e:
        logger.error(f"[StudyRoom] Error handling room end: {e}")


@sio.event
async def timer_start(sid: str, data: Dict[str, Any]):
    """Handle host starting the Pomodoro timer."""
    try:
        user_id = connected_users.get(sid)
        if not user_id:
            return

        room_code = data.get('roomCode')
        if not room_code:
            return

        timer_state = _timer_states.get(room_code)
        if not timer_state:
            return

        timer_state['isPaused'] = False
        _start_timer_task(room_code)

        # Broadcast immediately
        await _broadcast_timer_state(room_code)

        logger.info(f"[StudyRoom] Timer started in room {room_code}")

    except Exception as e:
        logger.error(f"[StudyRoom] Error handling timer start: {e}")


@sio.event
async def timer_pause(sid: str, data: Dict[str, Any]):
    """Handle host pausing the timer."""
    try:
        user_id = connected_users.get(sid)
        if not user_id:
            return

        room_code = data.get('roomCode')
        if not room_code:
            return

        timer_state = _timer_states.get(room_code)
        if timer_state:
            timer_state['isPaused'] = True
            await _broadcast_timer_state(room_code)

        logger.info(f"[StudyRoom] Timer paused in room {room_code}")

    except Exception as e:
        logger.error(f"[StudyRoom] Error handling timer pause: {e}")


@sio.event
async def timer_resume(sid: str, data: Dict[str, Any]):
    """Handle host resuming the timer."""
    try:
        user_id = connected_users.get(sid)
        if not user_id:
            return

        room_code = data.get('roomCode')
        if not room_code:
            return

        timer_state = _timer_states.get(room_code)
        if timer_state:
            timer_state['isPaused'] = False
            await _broadcast_timer_state(room_code)

        logger.info(f"[StudyRoom] Timer resumed in room {room_code}")

    except Exception as e:
        logger.error(f"[StudyRoom] Error handling timer resume: {e}")


@sio.event
async def timer_skip(sid: str, data: Dict[str, Any]):
    """Handle host skipping the current phase."""
    try:
        user_id = connected_users.get(sid)
        if not user_id:
            return

        room_code = data.get('roomCode')
        if not room_code:
            return

        timer_state = _timer_states.get(room_code)
        if timer_state:
            timer_state['remainingSeconds'] = 0
            await _broadcast_timer_state(room_code)

        logger.info(f"[StudyRoom] Timer phase skipped in room {room_code}")

    except Exception as e:
        logger.error(f"[StudyRoom] Error handling timer skip: {e}")


@sio.event
async def study_room_message(sid: str, data: Dict[str, Any]):
    """Handle chat message in a study room."""
    try:
        user_id = connected_users.get(sid)
        if not user_id:
            return

        room_code = data.get('roomCode')
        content = data.get('content')
        username = data.get('username', '')

        if not room_code or not content:
            return

        # Save to database
        async with AsyncSessionLocal() as db:
            service = StudyRoomService(db)
            is_member = await service.is_participant(room_code, user_id)
            if not is_member:
                return

            message = await service.save_message(room_code, user_id, content)
            if message and message.user:
                username = message.user.username
            user_ids = await service.get_participant_user_ids(room_code)

        message_data = {
            'roomCode': room_code,
            'userId': user_id,
            'username': username,
            'content': content,
            'createdAt': datetime.utcnow().isoformat(),
        }

        # Broadcast to all participants
        for uid in user_ids:
            participant_sid = get_user_sid(uid)
            if participant_sid:
                await sio.emit('study-room-message', message_data, to=participant_sid)

    except Exception as e:
        logger.error(f"[StudyRoom] Error handling message: {e}")


def register_study_room_handlers():
    """Register all study room Socket.io event handlers."""
    logger.info("[StudyRoom] Socket.io event handlers registered")
