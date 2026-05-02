from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..audit import log_action
from ..db import get_db
from ..deps import get_current_user, require_admin
from ..models import Child, Role, User
from ..schemas import UserCreate, UserOut, UserUpdate
from ..security import hash_password

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), me: User = Depends(get_current_user)) -> list[UserOut]:
    rows = db.scalars(
        select(User).where(User.family_id == me.family_id).order_by(User.role, User.display_name)
    ).all()
    return [UserOut.model_validate(u) for u in rows]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> UserOut:
    if payload.linked_child_id is not None:
        child = db.get(Child, payload.linked_child_id)
        if child is None or child.family_id != admin.family_id:
            raise HTTPException(status_code=400, detail="Linked child must belong to this family")

    user = User(
        family_id=admin.family_id,
        username=payload.username,
        display_name=payload.display_name,
        password_hash=hash_password(payload.password),
        role=payload.role,
        linked_child_id=payload.linked_child_id,
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists in this family")

    log_action(db, admin, "user.create", target=f"user:{user.id}", details=f"role={user.role.value}")
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
) -> UserOut:
    target = db.get(User, user_id)
    if target is None or target.family_id != me.family_id:
        raise HTTPException(status_code=404, detail="User not found")

    is_self = target.id == me.id
    if not (is_self or me.role == Role.admin):
        raise HTTPException(status_code=403, detail="Only admins can edit other users")

    if payload.role is not None:
        if me.role != Role.admin:
            raise HTTPException(status_code=403, detail="Only admins can change roles")
        if target.role == Role.admin and payload.role != Role.admin:
            other_admins = db.scalar(
                select(User).where(User.family_id == me.family_id, User.role == Role.admin, User.id != target.id)
            )
            if other_admins is None:
                raise HTTPException(status_code=400, detail="Cannot demote the last admin")
        target.role = payload.role

    if payload.display_name is not None:
        target.display_name = payload.display_name

    if payload.linked_child_id is not None:
        if me.role != Role.admin:
            raise HTTPException(status_code=403, detail="Only admins can change linked child")
        child = db.get(Child, payload.linked_child_id) if payload.linked_child_id else None
        if payload.linked_child_id and (child is None or child.family_id != me.family_id):
            raise HTTPException(status_code=400, detail="Linked child must belong to this family")
        target.linked_child_id = payload.linked_child_id

    if payload.password is not None:
        target.password_hash = hash_password(payload.password)

    log_action(db, me, "user.update", target=f"user:{target.id}")
    db.commit()
    db.refresh(target)
    return UserOut.model_validate(target)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    target = db.get(User, user_id)
    if target is None or target.family_id != admin.family_id:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    if target.role == Role.admin:
        other_admins = db.scalar(
            select(User).where(User.family_id == admin.family_id, User.role == Role.admin, User.id != target.id)
        )
        if other_admins is None:
            raise HTTPException(status_code=400, detail="Cannot delete the last admin")

    db.delete(target)
    log_action(db, admin, "user.delete", target=f"user:{user_id}")
    db.commit()
