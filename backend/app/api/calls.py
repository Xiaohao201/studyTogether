"""Call room API endpoints."""

import logging
from fastapi import APIRouter, HTTPException, status

from app.dependencies import CurrentUser, DBSession
from app.schemas.call import CallRoomCreate, CallRoomResponse, CallEnd
from app.services.call_service import CallService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/start", response_model=CallRoomResponse)
async def start_call(
    call_data: CallRoomCreate,
    current_user: CurrentUser,
    db: DBSession,
):
    """
    Initiate a new call.

    Creates a call room and notifies the target user via Socket.io.
    """
    try:
        call_service = CallService(db)

        # Create the call room
        call_room = await call_service.create_call_room(
            str(current_user.id),
            call_data
        )

        if not call_room:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target user not found"
            )

        logger.info(
            f"[Call] User {current_user.username} initiated {call_data.call_type} call "
            f"to user {call_data.target_user_id} (room: {call_room.room_code})"
        )

        return call_room

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        logger.error(f"[Call] Error starting call: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start call: {str(e)}"
        )


@router.get("/{room_code}", response_model=CallRoomResponse)
async def get_call_room(
    room_code: str,
    current_user: CurrentUser,
    db: DBSession,
):
    """
    Get call room details by room code.

    Used when joining an existing call.
    """
    try:
        call_service = CallService(db)
        call_room = await call_service.get_call_room_by_code(room_code)

        if not call_room:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Call room not found"
            )

        # Verify user is a participant
        user_ids = [str(p.user_id) for p in call_room.participants]
        if str(current_user.id) not in user_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a participant in this call"
            )

        return call_room

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Call] Error getting call room: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get call room"
        )


@router.post("/end", response_model=CallRoomResponse)
async def end_call(
    call_end_data: CallEnd,
    current_user: CurrentUser,
    db: DBSession,
):
    """
    End a call.

    Any participant can end the call.
    """
    try:
        call_service = CallService(db)

        # Verify user is a participant
        call_room = await call_service.get_call_room_by_id(call_end_data.room_id)
        if not call_room:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Call room not found"
            )

        user_ids = [str(p.user_id) for p in call_room.participants]
        if str(current_user.id) not in user_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a participant in this call"
            )

        # End the call
        updated_room = await call_service.end_call(
            call_end_data.room_id,
            str(current_user.id)
        )

        logger.info(
            f"[Call] User {current_user.username} ended call {call_room.room_code}"
        )

        return updated_room

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Call] Error ending call: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to end call"
        )


@router.get("/active/my-calls", response_model=list[CallRoomResponse])
async def get_my_active_calls(
    current_user: CurrentUser,
    db: DBSession,
):
    """
    Get user's active/ongoing calls.
    """
    try:
        call_service = CallService(db)
        active_calls = await call_service.get_user_active_calls(str(current_user.id))

        return active_calls

    except Exception as e:
        logger.error(f"[Call] Error getting active calls: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get active calls"
        )
