"""Friend management API endpoints."""

from fastapi import APIRouter, HTTPException, status

from app.schemas.friendship import (
    FriendRequestCreate,
    FriendshipResponse,
    FriendRequestsResponse,
    FriendListResponse,
)
from app.dependencies import CurrentUser, DBSession
from app.services.friendship_service import FriendshipService
from app.socket import sio, connected_users

router = APIRouter()


@router.get("", response_model=list[FriendListResponse])
async def get_friends(
    current_user: CurrentUser,
    db: DBSession,
):
    """Get list of accepted friends with online status."""
    service = FriendshipService(db)
    friends = await service.get_friends(str(current_user.id))

    # Populate online status from connected_users
    online_user_ids = set(connected_users.values())
    for friend in friends:
        friend.is_online = friend.id in online_user_ids

    return friends


@router.get("/requests", response_model=FriendRequestsResponse)
async def get_pending_requests(
    current_user: CurrentUser,
    db: DBSession,
):
    """Get pending friend requests (sent and received)."""
    service = FriendshipService(db)
    return await service.get_pending_requests(str(current_user.id))


@router.post("/request", response_model=FriendshipResponse, status_code=status.HTTP_201_CREATED)
async def send_friend_request(
    data: FriendRequestCreate,
    current_user: CurrentUser,
    db: DBSession,
):
    """Send a friend request to another user."""
    if data.addressee_id == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot send friend request to yourself",
        )

    service = FriendshipService(db)
    try:
        friendship = await service.send_request(
            str(current_user.id), data.addressee_id
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Determine the "other" user to get their info for the response
    from app.models.user import User
    from sqlalchemy import select
    import uuid

    other_id = uuid.UUID(data.addressee_id)
    result = await db.execute(select(User).where(User.id == other_id))
    other_user = result.scalar_one_or_none()

    if not other_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target user not found",
        )

    # Notify the addressee via Socket.io
    for sid, uid in connected_users.items():
        if uid == data.addressee_id:
            from app.schemas.friendship import FriendUserResponse
            await sio.emit("friend-request-received", {
                "friendship_id": str(friendship.id),
                "friend": FriendUserResponse.model_validate(current_user).model_dump(),
                "created_at": friendship.created_at.isoformat(),
            }, to=sid)
            break

    from app.schemas.friendship import FriendUserResponse
    return FriendshipResponse(
        id=str(friendship.id),
        requester_id=str(friendship.requester_id),
        addressee_id=str(friendship.addressee_id),
        status=friendship.status,
        created_at=friendship.created_at,
        updated_at=friendship.updated_at,
        friend=FriendUserResponse.model_validate(other_user),
    )


@router.put("/request/{friendship_id}/accept", response_model=FriendshipResponse)
async def accept_friend_request(
    friendship_id: str,
    current_user: CurrentUser,
    db: DBSession,
):
    """Accept a pending friend request."""
    service = FriendshipService(db)
    try:
        friendship = await service.accept_request(
            friendship_id, str(current_user.id)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Notify the original requester via Socket.io
    from app.schemas.friendship import FriendUserResponse
    requester_id_str = str(friendship.requester_id)
    addressee_id_str = str(friendship.addressee_id)
    # Notify the other user (not current)
    other_id = (
        requester_id_str if current_user.id != friendship.requester_id
        else addressee_id_str
    )
    for sid, uid in connected_users.items():
        if uid == other_id:
            await sio.emit("friend-request-accepted", {
                "friendship_id": str(friendship.id),
                "friend": FriendUserResponse.model_validate(current_user).model_dump(),
            }, to=sid)
            break

    # Get the other user for the response
    from app.models.user import User
    from sqlalchemy import select
    import uuid
    other_uuid = uuid.UUID(other_id)
    result = await db.execute(select(User).where(User.id == other_uuid))
    other_user = result.scalar_one_or_none()

    return FriendshipResponse(
        id=str(friendship.id),
        requester_id=requester_id_str,
        addressee_id=addressee_id_str,
        status=friendship.status,
        created_at=friendship.created_at,
        updated_at=friendship.updated_at,
        friend=FriendUserResponse.model_validate(other_user) if other_user else None,
    )


@router.put("/request/{friendship_id}/reject")
async def reject_friend_request(
    friendship_id: str,
    current_user: CurrentUser,
    db: DBSession,
):
    """Reject a pending friend request."""
    service = FriendshipService(db)
    try:
        await service.reject_request(friendship_id, str(current_user.id))
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    return {"message": "Friend request rejected"}


@router.delete("/{friendship_id}")
async def delete_friend(
    friendship_id: str,
    current_user: CurrentUser,
    db: DBSession,
):
    """Delete a friendship (unfriend)."""
    service = FriendshipService(db)
    try:
        await service.delete_friend(friendship_id, str(current_user.id))
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    return {"message": "Friend removed successfully"}
