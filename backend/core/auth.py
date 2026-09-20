import time
from typing import Dict, Optional, Tuple

from fastapi import Header, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.config import settings
from core.supabase import supabase

security = HTTPBearer(auto_error=False)

# In-memory token cache: token -> (user_id, expiry_timestamp)
# Caches verified tokens for 5 minutes to avoid redundant network calls to Supabase
_token_cache: Dict[str, Tuple[str, float]] = {}
CACHE_TTL_SECONDS = 300.0


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
    x_user_id: Optional[str] = Header(None, description="Legacy/Dev user UUID fallback"),
) -> str:
    """
    Authenticates the request using Supabase JWT from the Authorization header.
    Returns the authentic user UUID.

    In development mode, falls back to x_user_id if no token is provided.
    In production, valid JWT authentication is strictly enforced.
    """
    # 1. Check Bearer token from Authorization header
    if credentials and credentials.credentials:
        token = credentials.credentials.strip()
        now = time.time()

        # Check cache
        if token in _token_cache:
            user_id, expiry = _token_cache[token]
            if now < expiry:
                return user_id
            else:
                _token_cache.pop(token, None)

        try:
            user_response = supabase.auth.get_user(token)
            if user_response and user_response.user:
                user_id = str(user_response.user.id)
                # Store in cache
                _token_cache[token] = (user_id, now + CACHE_TTL_SECONDS)
                return user_id
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication session. Please sign in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # 2. In development environment, allow x_user_id as fallback
    if settings.ENVIRONMENT == "development":
        if x_user_id:
            return x_user_id
        # For quiz/demo convenience in local dev
        return "demo-user-123"

    # 3. In production, reject unauthenticated requests
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Please provide a valid Supabase Bearer token.",
        headers={"WWW-Authenticate": "Bearer"},
    )
