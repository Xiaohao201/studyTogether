"""User CRUD API endpoints."""

from fastapi import APIRouter, HTTPException, status

from app.schemas.user import PublicUserResponse
from app.dependencies import CurrentUser, DBSession
from app.services.auth_service import AuthService

router = APIRouter()


@router.get("/{user_id}", response_model=PublicUserResponse)
async def get_public_user_profile(
    user_id: str,
    db: DBSession,
):
    """
    Get public profile of a user.

    Returns non-sensitive information only:
    - username
    - subject
    - status
    - study_duration_minutes
    """
    auth_service = AuthService(db)
    user = await auth_service.get_user_by_id(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return PublicUserResponse.model_validate(user)
