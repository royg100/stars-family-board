from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..audit import log_action
from ..db import get_db
from ..deps import get_current_user, require_admin_or_parent
from ..models import Child, Prize, PrizeRedemption, Role, StarEvent, User
from ..schemas import (
    ChildOut,
    PrizeCreate,
    PrizeOut,
    PrizeRedemptionOut,
    PrizeUpdate,
    RedeemPrizeRequest,
    child_to_out,
)


router = APIRouter(prefix="/api/prizes", tags=["prizes"])


def _prize_out(p: Prize) -> PrizeOut:
    return PrizeOut.model_validate(p)


@router.get("", response_model=list[PrizeOut])
def list_prizes(db: Session = Depends(get_db), me: User = Depends(get_current_user)) -> list[PrizeOut]:
    rows = db.scalars(
        select(Prize)
        .where(Prize.family_id == me.family_id)
        .order_by(Prize.sort_order.asc(), Prize.id.asc())
    ).all()
    return [_prize_out(p) for p in rows]


@router.get("/redemptions", response_model=list[PrizeRedemptionOut])
def list_redemptions(
    limit: int = Query(default=40, ge=1, le=200),
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
) -> list[PrizeRedemptionOut]:
    stmt = (
        select(PrizeRedemption, Child.name)
        .join(Child, Child.id == PrizeRedemption.child_id)
        .where(Child.family_id == me.family_id)
    )
    if me.role == Role.child:
        if me.linked_child_id is None:
            return []
        stmt = stmt.where(PrizeRedemption.child_id == me.linked_child_id)
    stmt = stmt.order_by(PrizeRedemption.created_at.desc()).limit(limit)
    rows = db.execute(stmt).all()
    return [
        PrizeRedemptionOut(
            id=red.id,
            child_id=red.child_id,
            child_name=child_name,
            prize_name=red.prize_name,
            cost_stars=red.cost_stars,
            created_at=red.created_at,
        )
        for red, child_name in rows
    ]


@router.post("", response_model=PrizeOut, status_code=status.HTTP_201_CREATED)
def create_prize(
    payload: PrizeCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_parent),
) -> PrizeOut:
    max_order = db.scalar(select(func.max(Prize.sort_order)).where(Prize.family_id == user.family_id))
    order = (max_order or 0) + 1
    p = Prize(
        family_id=user.family_id,
        name=payload.name,
        cost_stars=payload.cost_stars,
        sort_order=order,
    )
    db.add(p)
    db.flush()
    log_action(db, user, "prize.create", target=f"prize:{p.id}", details=p.name)
    db.commit()
    db.refresh(p)
    return _prize_out(p)


@router.patch("/{prize_id}", response_model=PrizeOut)
def update_prize(
    prize_id: int,
    payload: PrizeUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_parent),
) -> PrizeOut:
    p = db.get(Prize, prize_id)
    if p is None or p.family_id != user.family_id:
        raise HTTPException(status_code=404, detail="Prize not found")
    if payload.name is not None:
        p.name = payload.name
    if payload.cost_stars is not None:
        p.cost_stars = payload.cost_stars
    log_action(db, user, "prize.update", target=f"prize:{p.id}")
    db.commit()
    db.refresh(p)
    return _prize_out(p)


@router.delete("/{prize_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prize(
    prize_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_parent),
):
    p = db.get(Prize, prize_id)
    if p is None or p.family_id != user.family_id:
        raise HTTPException(status_code=404, detail="Prize not found")
    log_action(db, user, "prize.delete", target=f"prize:{prize_id}")
    db.delete(p)
    db.commit()


@router.post("/{prize_id}/redeem", response_model=ChildOut)
def redeem_prize(
    prize_id: int,
    payload: RedeemPrizeRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_parent),
) -> ChildOut:
    prize = db.get(Prize, prize_id)
    if prize is None or prize.family_id != user.family_id:
        raise HTTPException(status_code=404, detail="Prize not found")
    child = db.get(Child, payload.child_id)
    if child is None or child.family_id != user.family_id:
        raise HTTPException(status_code=404, detail="Child not found")
    if child.stars < prize.cost_stars:
        raise HTTPException(
            status_code=400,
            detail=f"אין מספיק כוכבים (נדרשים {prize.cost_stars}, יש {child.stars})",
        )
    cost = prize.cost_stars
    child.stars -= cost
    db.add(
        StarEvent(
            child_id=child.id,
            delta=-cost,
            reason=f"פרס: {prize.name}",
            actor_user_id=user.id,
        )
    )
    db.add(
        PrizeRedemption(
            child_id=child.id,
            prize_id=prize.id,
            prize_name=prize.name,
            cost_stars=cost,
            actor_user_id=user.id,
        )
    )
    log_action(
        db,
        user,
        "prize.redeem",
        target=f"child:{child.id}",
        details=f"{prize.name} ({cost})",
    )
    db.commit()
    db.refresh(child)
    return child_to_out(child)
