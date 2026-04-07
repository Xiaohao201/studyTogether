"""Socket.io server initialization and configuration."""

import logging
from typing import Dict, Any
from python_socketio import AsyncServer

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Create Socket.io async server
sio = AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=settings.DEBUG,
    engineio_logger=settings.DEBUG,
)

# Store connected user IDs by socket session ID
connected_users: Dict[str, str] = {}


async def authenticate_socket(token: str) -> str | None:
    """
    Authenticate Socket.io connection using JWT token.

    Args:
        token: JWT access token

    Returns:
        User ID if authenticated, None otherwise
    """
    from app.core.security import decode_access_token

    payload = decode_access_token(token)
    if payload is None:
        return None

    return payload.get("sub")


@sio.event
async def connect(sid, environ, auth):
    """
    Handle client connection.

    Args:
        sid: Socket session ID
        environ: WSGI environ dict
        auth: Authentication data (should contain token)
    """
    try:
        token = auth.get('token') if auth else None
        if not token:
            # Also check query param
            query_string = environ.get('QUERY_STRING', '')
            if 'token=' in query_string:
                token = query_string.split('token=')[1].split('&')[0]

        if not token:
            logger.warning(f"[Socket] Connection rejected: No token provided (sid={sid})")
            return False

        user_id = await authenticate_socket(token)
        if not user_id:
            logger.warning(f"[Socket] Connection rejected: Invalid token (sid={sid})")
            return False

        # Store user mapping
        connected_users[sid] = user_id
        logger.info(f"[Socket] User {user_id} connected (sid={sid})")

        return True

    except Exception as e:
        logger.error(f"[Socket] Connection error: {e}")
        return False


@sio.event
async def disconnect(sid):
    """
    Handle client disconnection.

    Args:
        sid: Socket session ID
    """
    user_id = connected_users.pop(sid, None)
    if user_id:
        logger.info(f"[Socket] User {user_id} disconnected (sid={sid})")


def get_socket_app() -> AsyncServer:
    """Get the Socket.io server instance."""
    return sio
