from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..audit import log_action
from ..db import get_db
from ..deps import get_current_user, require_admin_or_parent
from ..models import Child, StarEvent, User
from ..schemas import ChildOut, StarChange, StarEventOut, WeekResetRequest, child_to_out

router = APIRouter(prefix="/api", tags=["stars"])


@router.post("/children/{child_id}/stars", response_model=ChildOut)
def change_stars(
    child_id: int,
    payload: StarChange,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_parent),
) -> ChildOut:
    if payload.delta == 0:
        raise HTTPException(status_code=400, detail="Delta must be non-zero")
    child = db.get(Child, child_id)
    if child is None or child.family_id != user.family_id:
        raise HTTPException(status_code=404, detail="Child not found")

    new_total = max(0, child.stars + payload.delta)
    actual_delta = new_total - child.stars
    child.stars = new_total

    if actual_delta != 0:
        db.add(StarEvent(child_id=child.id, delta=actual_delta, reason=payload.reason, actor_user_id=user.id))
    log_action(db, user, "stars.change", target=f"child:{child.id}", details=f"delta={actual_delta}")
    db.commit()
    db.refresh(child)
    return child_to_out(child)


@router.get("/children/{child_id}/events", response_model=list[StarEventOut])
def list_events(
    child_id: int,
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
) -> list[StarEventOut]:
    child = db.get(Child, child_id)
    if child is None or child.family_id != me.family_id:
        raise HTTPException(status_code=404, detail="Child not found")
    if me.role.value == "child" and me.linked_child_id != child.id:
        raise HTTPException(status_code=403, detail="Children can only view their own events")
    rows = db.scalars(
        select(StarEvent).where(StarEvent.child_id == child_id).order_by(StarEvent.created_at.desc()).limit(limit)
    ).all()
    return [StarEventOut.model_validate(e) for e in rows]


@router.post("/week-reset", status_code=204)
def week_reset(
    payload: WeekResetRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_parent),
):
    if not payload.confirm:
        raise HTTPException(status_code=400, detail="Confirmation required")

    children = db.scalars(select(Child).where(Child.family_id == user.family_id)).all()
    for child in children:
        if child.stars != 0:
            db.add(StarEvent(child_id=child.id, delta=-child.stars, reason="איפוס שבועי", actor_user_id=user.id))
    db.execute(update(Child).where(Child.family_id == user.family_id).values(stars=0))
    log_action(db, user, "stars.week_reset", target=f"family:{user.family_id}")
    db.commit()
