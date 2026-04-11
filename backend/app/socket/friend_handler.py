"""Socket.io friend event handlers for online status broadcasting."""

import logging
from typing import Dict, Set

from app.socket import sio, connected_users
from app.core.database import AsyncSessionLocal
from app.services.friendship_service import FriendshipService

logger = logging.getLogger(__name__)

# Cache: user_id -> set of friend user_ids
user_friends_cache: Dict[str, Set[str]] = {}


async def get_friends_with_cache(user_id: str) -> Set[str]:
    """Get friend IDs with caching to avoid DB queries on every connect."""
    if user_id in user_friends_cache:
        return user_friends_cache[user_id]

    try:
        async with AsyncSessionLocal() as db:
            service = FriendshipService(db)
            friend_ids = await service.get_friend_ids(user_id)
            user_friends_cache[user_id] = friend_ids
            return friend_ids
    except Exception as e:
        logger.error(f"[FriendHandler] Error getting friends for {user_id}: {e}")
        return set()


def invalidate_friends_cache(user_id: str) -> None:
    """Invalidate cached friends for a user (call on friend add/remove)."""
    user_friends_cache.pop(user_id, None)


async def broadcast_friend_online(user_id: str, is_online: bool) -> None:
    """
    Broadcast friend online/offline status to all online friends.

    Also sends the full list of online friend IDs to the connecting user.
    """
    friend_ids = await get_friends_with_cache(user_id)

    # Find online friend SIDs
    online_friend_ids: Set[str] = set()
    for sid, uid in connected_users.items():
        if uid in friend_ids:
            online_friend_ids.add(uid)

    # Broadcast to online friends that this user changed status
    status_data = {
        "userId": user_id,
        "isOnline": is_online,
    }
    for sid, uid in connected_users.items():
        if uid in friend_ids:
            await sio.emit("friend-status-change", status_data, to=sid)

    # If coming online, send all online friend IDs to this user
    if is_online:
        for sid, uid in connected_users.items():
            if uid == user_id:
                await sio.emit("friend-status-change", {
                    "onlineFriendIds": list(online_friend_ids),
                }, to=sid)
                break


async def handle_friend_connect(user_id: str) -> None:
    """Called when a user connects via Socket.io."""
    await broadcast_friend_online(user_id, is_online=True)


async def handle_friend_disconnect(user_id: str) -> None:
    """Called when a user disconnects from Socket.io."""
    # Invalidate cache since we don't need it anymore
    user_friends_cache.pop(user_id, None)
    await broadcast_friend_online(user_id, is_online=False)
