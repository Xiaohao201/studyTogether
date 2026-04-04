"""Authentication service for user management and JWT token handling."""

import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.auth import UserCreate, UserLogin
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
)


class AuthService:
    """Service for authentication operations."""

    def __init__(self, db: AsyncSession):
        """Initialize auth service with database session."""
        self.db = db

    async def register(self, user_data: UserCreate) -> User:
        """
        Register a new user.

        Args:
            user_data: User creation data (username, email, password)

        Returns:
            Created user object

        Raises:
            ValueError: If email or username already exists
        """
        # Check if email exists
        result = await self.db.execute(
            select(User).where(User.email == user_data.email)
        )
        if result.scalar_one_or_none():
            raise ValueError("Email already registered")

        # Check if username exists
        result = await self.db.execute(
            select(User).where(User.username == user_data.username)
        )
        if result.scalar_one_or_none():
            raise ValueError("Username already taken")

        # Create new user
        user = User(
            id=uuid.uuid4(),
            username=user_data.username,
            email=user_data.email,
            hashed_password=get_password_hash(user_data.password),
            status='offline',
            privacy_mode='fuzzy',
        )

        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)

        return user

    async def login(self, credentials: UserLogin) -> tuple[User, str, str]:
        """
        Authenticate user and generate tokens.

        Args:
            credentials: Login credentials (email, password)

        Returns:
            Tuple of (user, access_token, refresh_token)

        Raises:
            ValueError: If email or password is invalid
        """
        # Find user by email
        result = await self.db.execute(
            select(User).where(User.email == credentials.email)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("Invalid email or password")

        # Verify password
        if not verify_password(credentials.password, user.hashed_password):
            raise ValueError("Invalid email or password")

        # Update last_seen_at
        user.last_seen_at = datetime.utcnow()
        await self.db.commit()

        # Generate tokens
        token_data = {"sub": str(user.id)}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        return user, access_token, refresh_token

    async def get_user_by_id(self, user_id: str) -> Optional[User]:
        """
        Get user by ID.

        Args:
            user_id: User UUID

        Returns:
            User object or None if not found
        """
        result = await self.db.execute(
            select(User).where(User.id == uuid.UUID(user_id))
        )
        return result.scalar_one_or_none()

    async def update_last_seen(self, user_id: str) -> None:
        """
        Update user's last_seen_at timestamp.

        Args:
            user_id: User UUID
        """
        user = await self.get_user_by_id(user_id)
        if user:
            user.last_seen_at = datetime.utcnow()
            await self.db.commit()
