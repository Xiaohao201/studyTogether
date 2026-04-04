"""Authentication API endpoints."""

from fastapi import APIRouter, HTTPException, status

from app.schemas.auth import (
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
)
from app.schemas.user import UserUpdate
from app.dependencies import AuthServiceDep, CurrentUser
from app.services.auth_service import AuthService

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    auth_service: AuthServiceDep,
):
    """
    Register a new user.

    - **username**: Display name (3-50 characters)
    - **email**: Valid email address
    - **password**: Min 8 characters
    """
    try:
        user = await auth_service.register(user_data)
        # Convert user to dict and ensure UUID is string
        user_dict = {
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "subject": user.subject,
            "status": user.status,
            "study_duration_minutes": user.study_duration_minutes,
            "privacy_mode": user.privacy_mode,
            "show_exact_to_friends": user.show_exact_to_friends,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
            "last_seen_at": user.last_seen_at,
        }
        return UserResponse(**user_dict)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/login", response_model=TokenResponse)
async def login(
    credentials: UserLogin,
    auth_service: AuthServiceDep,
):
    """
    Login with email and password.

    Returns access token (15min expiry) and refresh token (7 days expiry).
    """
    try:
        user, access_token, refresh_token = await auth_service.login(credentials)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            user=UserResponse.model_validate(user)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: CurrentUser,
):
    """Get current authenticated user profile."""
    return UserResponse.model_validate(current_user)


@router.put("/me", response_model=UserResponse)
async def update_current_user_profile(
    update_data: UserUpdate,
    current_user: CurrentUser,
    db_session: AuthServiceDep,
):
    """
    Update current user profile.

    - **username**: New display name (optional)
    - **subject**: Current study subject (optional)
    - **status**: Activity status - studying/break/offline (optional)
    - **privacy_mode**: Location visibility - exact/fuzzy/invisible (optional)
    - **show_exact_to_friends**: Whether friends see exact location (optional)
    """
    # Update fields if provided
    if update_data.username is not None:
        current_user.username = update_data.username
    if update_data.subject is not None:
        current_user.subject = update_data.subject
    if update_data.status is not None:
        current_user.status = update_data.status
    if update_data.privacy_mode is not None:
        current_user.privacy_mode = update_data.privacy_mode
    if update_data.show_exact_to_friends is not None:
        current_user.show_exact_to_friends = update_data.show_exact_to_friends

    await db_session.db.commit()
    await db_session.db.refresh(current_user)

    return UserResponse.model_validate(current_user)
