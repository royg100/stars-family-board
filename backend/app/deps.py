from collections.abc import Iterable

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import Role, User
from .security import read_session_token


def get_current_user(
    db: Session = Depends(get_db),
    session_cookie: str | None = Cookie(default=None, alias=settings.session_cookie_name),
) -> User:
    if not session_cookie:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user_id = read_session_token(session_cookie)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_roles(*roles: Role):
    allowed: tuple[Role, ...] = roles

    def dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return dep


def require_same_family(user: User, family_id: int) -> None:
    if user.family_id != family_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cross-family access denied")


def require_admin_or_parent(user: User = Depends(get_current_user)) -> User:
    if user.role not in (Role.admin, Role.parent):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Parent or admin only")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user


def roles_in(user: User, roles: Iterable[Role]) -> bool:
    return user.role in tuple(roles)
