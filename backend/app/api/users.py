"""User CRUD API endpoints."""

from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.user import PublicUserResponse
from app.dependencies import CurrentUser, DBSession
from app.services.auth_service import AuthService
from app.models.user import User

router = APIRouter()


@router.get("/search", response_model=list[PublicUserResponse])
async def search_users(
    q: str = Query(..., min_length=1, max_length=100, description="Search query"),
    limit: int = Query(default=10, ge=1, le=50, description="Max results"),
    current_user: CurrentUser = None,
    db: DBSession = None,
):
    """
    Search users by username or email.

    Returns public profiles matching the query.
    Excludes the current user from results.
    """
    query = (
        select(User)
        .where(
            or_(
                User.username.ilike(f"%{q}%"),
                User.email.ilike(f"%{q}%"),
            )
        )
        .where(User.id != current_user.id)
        .limit(limit)
    )

    result = await db.execute(query)
    users = result.scalars().all()

    return [PublicUserResponse.model_validate(u) for u in users]


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
