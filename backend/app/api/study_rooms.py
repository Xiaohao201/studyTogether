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

        return study_room

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[StudyRoom] Error creating study room: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create study room"
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

        # Verify user is a participant
        is_member = await service.is_participant(room_code, str(current_user.id))
        if not is_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a participant in this study room"
            )

        return study_room

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[StudyRoom] Error getting study room: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get study room"
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

        return study_room

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[StudyRoom] Error ending study room: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to end study room"
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

        # Verify user is a participant
        is_member = await service.is_participant(room_code, str(current_user.id))
        if not is_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a participant in this study room"
            )

        participant = await service.leave_study_room(room_code, str(current_user.id))

        logger.info(
            f"[StudyRoom] User {current_user.username} left study room {room_code}"
        )

        return {"success": True, "message": "Left study room"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[StudyRoom] Error leaving study room: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to leave study room"
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

        # Verify user is a participant
        is_member = await service.is_participant(room_code, str(current_user.id))
        if not is_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a participant in this study room"
            )

        messages = await service.get_messages(room_code, limit=limit, offset=offset)
        return messages

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[StudyRoom] Error getting messages: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get messages"
        )
