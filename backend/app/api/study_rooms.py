"""Study room API endpoints."""

import logging
from fastapi import APIRouter, HTTPException, Query, status

from app.dependencies import CurrentUser, DBSession
from app.schemas.study_room import (
    StudyRoomCreate,
    StudyRoomResponse,
    StudyRoomEnd,
    StudyRoomMessageCreate,
    StudyRoomMessageResponse,
)
from app.services.study_room_service import StudyRoomService

logger = logging.getLogger(__name__)

router = APIRouter()


def _build_room_response(study_room) -> dict:
    """Convert ORM StudyRoom to response dict, extracting usernames from relationships."""
    return {
        "id": str(study_room.id),
        "room_code": study_room.room_code,
        "host_id": str(study_room.host_id),
        "subject": study_room.subject,
        "room_status": study_room.room_status,
        "focus_duration": study_room.focus_duration,
        "break_duration": study_room.break_duration,
        "started_at": study_room.started_at,
        "ended_at": study_room.ended_at,
        "created_at": study_room.created_at,
        "participants": [
            {
                "id": str(p.id),
                "study_room_id": str(p.study_room_id),
                "user_id": str(p.user_id),
                "username": p.user.username if p.user else None,
                "joined_at": p.joined_at,
                "left_at": p.left_at,
            }
            for p in study_room.participants
        ],
    }


def _build_message_response(message) -> dict:
    """Convert ORM StudyRoomMessage to response dict."""
    return {
        "id": str(message.id),
        "study_room_id": str(message.study_room_id),
        "user_id": str(message.user_id),
        "username": message.user.username if message.user else None,
        "content": message.content,
        "created_at": message.created_at,
    }


@router.post("/start", response_model=StudyRoomResponse)
async def start_study_room(
    room_data: StudyRoomCreate,
    current_user: CurrentUser,
    db: DBSession,
):
    """Create a study room and invite a user."""
    try:
        service = StudyRoomService(db)
        study_room = await service.create_study_room(
            str(current_user.id),
            room_data
        )

        if not study_room:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target user not found"
            )

        logger.info(
            f"[StudyRoom] User {current_user.username} created study room "
            f"(room: {study_room.room_code})"
        )

        return _build_room_response(study_room)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[StudyRoom] Error creating study room: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create study room: {e}"
        )


@router.get("/{room_code}", response_model=StudyRoomResponse)
async def get_study_room(
    room_code: str,
    current_user: CurrentUser,
    db: DBSession,
):
    """Get study room details (members only)."""
    try:
        service = StudyRoomService(db)
        study_room = await service.get_study_room_by_code(room_code)

        if not study_room:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Study room not found"
            )

        is_member = await service.is_participant(room_code, str(current_user.id))
        if not is_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a participant in this study room"
            )

        return _build_room_response(study_room)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[StudyRoom] Error getting study room: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get study room: {e}"
        )


@router.post("/end", response_model=StudyRoomResponse)
async def end_study_room(
    end_data: StudyRoomEnd,
    current_user: CurrentUser,
    db: DBSession,
):
    """End a study room (host only)."""
    try:
        service = StudyRoomService(db)
        study_room = await service.end_study_room(
            end_data.room_code,
            str(current_user.id)
        )

        if not study_room:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the host can end the study room, or room not found"
            )

        logger.info(
            f"[StudyRoom] User {current_user.username} ended study room {end_data.room_code}"
        )

        return _build_room_response(study_room)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[StudyRoom] Error ending study room: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to end study room: {e}"
        )


@router.post("/{room_code}/leave")
async def leave_study_room(
    room_code: str,
    current_user: CurrentUser,
    db: DBSession,
):
    """Leave a study room."""
    try:
        service = StudyRoomService(db)

        is_member = await service.is_participant(room_code, str(current_user.id))
        if not is_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a participant in this study room"
            )

        await service.leave_study_room(room_code, str(current_user.id))

        logger.info(
            f"[StudyRoom] User {current_user.username} left study room {room_code}"
        )

        return {"success": True, "message": "Left study room"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[StudyRoom] Error leaving study room: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to leave study room: {e}"
        )


@router.get("/{room_code}/messages", response_model=list[StudyRoomMessageResponse])
async def get_study_room_messages(
    room_code: str,
    current_user: CurrentUser,
    db: DBSession,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Get chat message history (members only)."""
    try:
        service = StudyRoomService(db)

        is_member = await service.is_participant(room_code, str(current_user.id))
        if not is_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a participant in this study room"
            )

        messages = await service.get_messages(room_code, limit=limit, offset=offset)
        return [_build_message_response(m) for m in messages]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[StudyRoom] Error getting messages: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get messages: {e}"
        )
