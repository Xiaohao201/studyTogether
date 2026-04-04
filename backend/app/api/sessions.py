"""Study session API endpoints."""

from fastapi import APIRouter, HTTPException, status

from app.schemas.session import SessionCreate, SessionResponse
from app.dependencies import CurrentUser, DBSession
from app.services.session_service import SessionService

router = APIRouter()


@router.post("/", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_study_session(
    session_data: SessionCreate,
    current_user: CurrentUser,
    db: DBSession,
):
    """
    Start a new study session.

    - **subject**: Study subject/topic (e.g., "Python编程", "考研数学")

    User can only have one active session at a time.
    """
    session_service = SessionService(db)

    # Check if user already has an active session
    active_session = await session_service.get_active_session(str(current_user.id))
    if active_session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have an active session. Please end it first.",
        )

    # Create new session
    session = await session_service.create_session(str(current_user.id), session_data)

    return SessionResponse.model_validate(session)


@router.put("/{session_id}/end", response_model=SessionResponse)
async def end_study_session(
    session_id: str,
    current_user: CurrentUser,
    db: DBSession,
):
    """
    End a study session.

    Calculates and stores the duration in minutes.
    Also updates user's total study time.
    """
    session_service = SessionService(db)

    session = await session_service.end_session(session_id, str(current_user.id))

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active session not found or already ended",
        )

    return SessionResponse.model_validate(session)


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    current_user: CurrentUser,
    db: DBSession,
):
    """Get details of a specific session (own sessions only)."""
    session_service = SessionService(db)

    session = await session_service.get_session(session_id, str(current_user.id))

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    return SessionResponse.model_validate(session)


@router.get("/", response_model=list[SessionResponse])
async def get_my_sessions(
    current_user: CurrentUser,
    db: DBSession,
    limit: int = 50,
):
    """
    Get all sessions for current user.

    Returns sessions ordered by start time (newest first).
    """
    session_service = SessionService(db)

    sessions = await session_service.get_user_sessions(
        str(current_user.id),
        limit=limit
    )

    return [SessionResponse.model_validate(s) for s in sessions]


@router.get("/active", response_model=SessionResponse)
async def get_active_session(
    current_user: CurrentUser,
    db: DBSession,
):
    """
    Get current user's active session (if any).

    Returns 404 if no active session exists.
    """
    session_service = SessionService(db)

    session = await session_service.get_active_session(str(current_user.id))

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active session found",
        )

    return SessionResponse.model_validate(session)
