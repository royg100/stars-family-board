from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..audit import log_action
from ..config import settings
from ..db import get_db
from ..deps import get_current_user
from ..models import Family, Role, User
from ..schemas import FamilyOut, FamilyRegister, LoginRequest, MeResponse, UserOut
from ..security import create_session_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_session_cookie(response: Response, user_id: int) -> None:
    token = create_session_token(user_id)
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.session_max_age_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        settings.session_cookie_name,
        path="/",
        secure=settings.cookie_secure,
        samesite="lax",
    )


@router.post("/register", response_model=MeResponse, status_code=status.HTTP_201_CREATED)
def register_family(payload: FamilyRegister, response: Response, db: Session = Depends(get_db)) -> MeResponse:
    family = Family(name=payload.family_name)
    db.add(family)
    db.flush()

    admin = User(
        family_id=family.id,
        username=payload.admin_username,
        display_name=payload.admin_display_name,
        password_hash=hash_password(payload.admin_password),
        role=Role.admin,
    )
    db.add(admin)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists in this family")

    log_action(db, admin, "family.register", target=f"family:{family.id}")
    db.commit()
    db.refresh(admin)
    db.refresh(family)

    _set_session_cookie(response, admin.id)
    return MeResponse(user=UserOut.model_validate(admin), family=FamilyOut.model_validate(family))


@router.post("/login", response_model=MeResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> MeResponse:
    user = db.scalar(
        select(User).where(User.family_id == payload.family_id, User.username == payload.username)
    )
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    family = db.get(Family, user.family_id)
    if family is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family not found")

    log_action(db, user, "auth.login")
    db.commit()
    _set_session_cookie(response, user.id)
    return MeResponse(user=UserOut.model_validate(user), family=FamilyOut.model_validate(family))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Response:
    log_action(db, user, "auth.logout")
    db.commit()
    _clear_session_cookie(response)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=MeResponse)
def me(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> MeResponse:
    family = db.get(Family, user.family_id)
    assert family is not None
    return MeResponse(user=UserOut.model_validate(user), family=FamilyOut.model_validate(family))


@router.get("/families/lookup", response_model=list[FamilyOut])
def list_families(db: Session = Depends(get_db)) -> list[FamilyOut]:
    families = db.scalars(select(Family).order_by(Family.name)).all()
    return [FamilyOut.model_validate(f) for f in families]
