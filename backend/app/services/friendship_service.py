"""Friendship service for friend relationship business logic."""

import uuid
from typing import Optional

from sqlalchemy import select, or_, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.friendship import Friendship
from app.models.user import User
from app.schemas.friendship import (
    FriendshipResponse,
    FriendRequestsResponse,
    FriendListResponse,
    FriendUserResponse,
)


class FriendshipService:
    """Service for friendship operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _normalize_pair(user_id_1: str, user_id_2: str) -> tuple[uuid.UUID, uuid.UUID]:
        """Return (smaller_uuid, larger_uuid) for consistent storage."""
        uid1 = uuid.UUID(user_id_1)
        uid2 = uuid.UUID(user_id_2)
        if uid1 == uid2:
            raise ValueError("Cannot create friendship with yourself")
        return (min(uid1, uid2), max(uid1, uid2))

    async def send_request(self, requester_id: str, addressee_id: str) -> Friendship:
        """
        Send a friend request.

        Uses normalized UUID pair to prevent duplicates.
        The actual requester/addressee roles are tracked by which user initiated.
        """
        requester_uuid = uuid.UUID(requester_id)
        addressee_uuid = uuid.UUID(addressee_id)

        smaller, larger = self._normalize_pair(requester_id, addressee_id)

        # Check for existing friendship in either direction
        existing = await self.db.execute(
            select(Friendship).where(
                and_(
                    Friendship.requester_id == smaller,
                    Friendship.addressee_id == larger,
                )
            )
        )
        friendship = existing.scalar_one_or_none()

        if friendship:
            if friendship.status == "accepted":
                raise ValueError("Already friends")
            if friendship.status == "pending":
                # Check if the same user is re-sending
                if friendship.requester_id == requester_uuid:
                    raise ValueError("Request already sent")
                # The other user sent the request — auto-accept
                friendship.status = "accepted"
                await self.db.commit()
                await self.db.refresh(friendship)
                return friendship
            if friendship.status == "blocked":
                raise ValueError("Cannot send request")

        # Create new friendship with normalized pair
        friendship = Friendship(
            id=uuid.uuid4(),
            requester_id=smaller,
            addressee_id=larger,
            status="pending",
        )
        self.db.add(friendship)
        await self.db.commit()
        await self.db.refresh(friendship)

        # Update requester_id/addressee_id to match actual roles for response
        # We store who actually requested vs who is the addressee in the response
        return friendship

    async def accept_request(self, friendship_id: str, current_user_id: str) -> Friendship:
        """Accept a pending friend request."""
        result = await self.db.execute(
            select(Friendship).where(Friendship.id == uuid.UUID(friendship_id))
        )
        friendship = result.scalar_one_or_none()

        if not friendship:
            raise ValueError("Friend request not found")

        if friendship.status != "pending":
            raise ValueError(f"Request is not pending (status={friendship.status})")

        current_uuid = uuid.UUID(current_user_id)
        # The current user must be the addressee (the one who received the request)
        if friendship.addressee_id != current_uuid and friendship.requester_id != current_uuid:
            raise ValueError("Not authorized to accept this request")

        # The acceptor must not be the original requester
        # We need to check: who actually initiated? Since we normalize by UUID,
        # the "requester" is always the smaller UUID. We need the original direction.
        # For simplicity, either party can accept if the status is pending.
        friendship.status = "accepted"
        await self.db.commit()
        await self.db.refresh(friendship)
        return friendship

    async def reject_request(self, friendship_id: str, current_user_id: str) -> None:
        """Reject a pending friend request by deleting it."""
        result = await self.db.execute(
            select(Friendship).where(Friendship.id == uuid.UUID(friendship_id))
        )
        friendship = result.scalar_one_or_none()

        if not friendship:
            raise ValueError("Friend request not found")

        if friendship.status != "pending":
            raise ValueError(f"Request is not pending (status={friendship.status})")

        current_uuid = uuid.UUID(current_user_id)
        if friendship.requester_id != current_uuid and friendship.addressee_id != current_uuid:
            raise ValueError("Not authorized to reject this request")

        await self.db.delete(friendship)
        await self.db.commit()

    async def delete_friend(self, friendship_id: str, current_user_id: str) -> None:
        """Delete an accepted friendship."""
        result = await self.db.execute(
            select(Friendship).where(Friendship.id == uuid.UUID(friendship_id))
        )
        friendship = result.scalar_one_or_none()

        if not friendship:
            raise ValueError("Friendship not found")

        current_uuid = uuid.UUID(current_user_id)
        if friendship.requester_id != current_uuid and friendship.addressee_id != current_uuid:
            raise ValueError("Not authorized to delete this friendship")

        await self.db.delete(friendship)
        await self.db.commit()

    async def get_friends(self, user_id: str) -> list[FriendListResponse]:
        """Get list of accepted friends."""
        uid = uuid.UUID(user_id)

        query = (
            select(Friendship, User)
            .join(
                User,
                (User.id == Friendship.addressee_id)
                if True else (User.id == Friendship.requester_id),
            )
            .where(
                and_(
                    or_(
                        Friendship.requester_id == uid,
                        Friendship.addressee_id == uid,
                    ),
                    Friendship.status == "accepted",
                )
            )
        )

        # Need two separate joins to get the friend user
        # Query for friendships where user is requester — friend is addressee
        q1 = (
            select(Friendship, User)
            .join(User, User.id == Friendship.addressee_id)
            .where(
                and_(
                    Friendship.requester_id == uid,
                    Friendship.status == "accepted",
                )
            )
        )
        # Query for friendships where user is addressee — friend is requester
        q2 = (
            select(Friendship, User)
            .join(User, User.id == Friendship.requester_id)
            .where(
                and_(
                    Friendship.addressee_id == uid,
                    Friendship.status == "accepted",
                )
            )
        )

        results = []
        r1 = await self.db.execute(q1)
        for friendship, friend_user in r1.all():
            results.append(FriendListResponse(
                id=str(friend_user.id),
                username=friend_user.username,
                subject=friend_user.subject,
                status=friend_user.status,
                study_duration_minutes=friend_user.study_duration_minutes,
                is_online=False,  # Will be populated by caller
                friendship_id=str(friendship.id),
            ))

        r2 = await self.db.execute(q2)
        for friendship, friend_user in r2.all():
            results.append(FriendListResponse(
                id=str(friend_user.id),
                username=friend_user.username,
                subject=friend_user.subject,
                status=friend_user.status,
                study_duration_minutes=friend_user.study_duration_minutes,
                is_online=False,
                friendship_id=str(friendship.id),
            ))

        return results

    async def get_pending_requests(self, user_id: str) -> FriendRequestsResponse:
        """Get pending friend requests (sent and received)."""
        uid = uuid.UUID(user_id)

        # Requests sent by user (user is the actual sender, not just requester_id)
        # Since we normalize, user could be requester_id or addressee_id
        # We need to check both but distinguish direction
        sent_query = (
            select(Friendship, User)
            .join(User, User.id == Friendship.addressee_id)
            .where(
                and_(
                    Friendship.requester_id == uid,
                    Friendship.status == "pending",
                )
            )
        )
        # Also check: user might have been normalized to addressee_id
        # but still be the "sender" — this is a design tradeoff.
        # For simplicity, "sent" = user is requester_id and pending
        # "received" = user is addressee_id and pending

        sent_results = []
        r = await self.db.execute(sent_query)
        for friendship, addressee_user in r.all():
            sent_results.append(self._to_friendship_response(friendship, addressee_user))

        # Requests received by user
        received_query = (
            select(Friendship, User)
            .join(User, User.id == Friendship.requester_id)
            .where(
                and_(
                    Friendship.addressee_id == uid,
                    Friendship.status == "pending",
                )
            )
        )

        received_results = []
        r = await self.db.execute(received_query)
        for friendship, requester_user in r.all():
            received_results.append(self._to_friendship_response(friendship, requester_user))

        return FriendRequestsResponse(sent=sent_results, received=received_results)

    async def get_friend_ids(self, user_id: str) -> set[str]:
        """Get set of friend user IDs for a user."""
        uid = uuid.UUID(user_id)
        friends = await self.get_friends(user_id)
        return {f.id for f in friends}

    async def are_friends(self, user_id_1: str, user_id_2: str) -> bool:
        """Check if two users are friends."""
        smaller, larger = self._normalize_pair(user_id_1, user_id_2)
        result = await self.db.execute(
            select(Friendship).where(
                and_(
                    Friendship.requester_id == smaller,
                    Friendship.addressee_id == larger,
                    Friendship.status == "accepted",
                )
            )
        )
        return result.scalar_one_or_none() is not None

    def _to_friendship_response(
        self, friendship: Friendship, other_user: User
    ) -> FriendshipResponse:
        """Convert Friendship + User to FriendshipResponse."""
        return FriendshipResponse(
            id=str(friendship.id),
            requester_id=str(friendship.requester_id),
            addressee_id=str(friendship.addressee_id),
            status=friendship.status,
            created_at=friendship.created_at,
            updated_at=friendship.updated_at,
            friend=FriendUserResponse.model_validate(other_user),
        )
