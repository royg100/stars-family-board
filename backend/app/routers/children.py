from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..audit import log_action
from ..config import settings
from ..db import get_db
from ..deps import get_current_user, require_admin_or_parent
from ..models import Child, Role, User
from ..schemas import ChildCreate, ChildOut, ChildUpdate, child_to_out

router = APIRouter(prefix="/api/children", tags=["children"])

CHILD_MEDIA_DIR: Path = settings.uploads_dir / "children"


def _unlink_child_photo(filename: str | None) -> None:
    if not filename:
        return
    p = CHILD_MEDIA_DIR / filename
    try:
        if p.is_file() and p.resolve().parent == CHILD_MEDIA_DIR.resolve():
            p.unlink()
    except OSError:
        pass


def _detect_image_format(data: bytes) -> str:
    if len(data) < 12:
        raise HTTPException(status_code=400, detail="תמונה לא תקינה")
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    raise HTTPException(status_code=400, detail="נא להעלות JPEG, PNG או WebP")


def _visible_children(db: Session, user: User) -> list[Child]:
    stmt = select(Child).where(Child.family_id == user.family_id)
    if user.role == Role.child:
        if user.linked_child_id is None:
            return []
        stmt = stmt.where(Child.id == user.linked_child_id)
    return list(db.scalars(stmt.order_by(Child.stars.desc(), Child.name)).all())


@router.get("", response_model=list[ChildOut])
def list_children(db: Session = Depends(get_db), me: User = Depends(get_current_user)) -> list[ChildOut]:
    return [child_to_out(c) for c in _visible_children(db, me)]


@router.post("", response_model=ChildOut, status_code=status.HTTP_201_CREATED)
def create_child(
    payload: ChildCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_parent),
) -> ChildOut:
    child = Child(family_id=user.family_id, name=payload.name)
    db.add(child)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Child with that name already exists")
    log_action(db, user, "child.create", target=f"child:{child.id}", details=child.name)
    db.commit()
    db.refresh(child)
    return child_to_out(child)


@router.patch("/{child_id}", response_model=ChildOut)
def update_child(
    child_id: int,
    payload: ChildUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_parent),
) -> ChildOut:
    child = db.get(Child, child_id)
    if child is None or child.family_id != user.family_id:
        raise HTTPException(status_code=404, detail="Child not found")
    if payload.name is not None:
        child.name = payload.name
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Name conflict")
    log_action(db, user, "child.update", target=f"child:{child.id}")
    db.commit()
    db.refresh(child)
    return child_to_out(child)


@router.delete("/{child_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_child(
    child_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_parent),
):
    child = db.get(Child, child_id)
    if child is None or child.family_id != user.family_id:
        raise HTTPException(status_code=404, detail="Child not found")
    _unlink_child_photo(child.photo_filename)
    db.delete(child)
    log_action(db, user, "child.delete", target=f"child:{child_id}")
    db.commit()


@router.post("/{child_id}/photo", response_model=ChildOut)
async def upload_child_photo(
    child_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_parent),
) -> ChildOut:
    child = db.get(Child, child_id)
    if child is None or child.family_id != user.family_id:
        raise HTTPException(status_code=404, detail="Child not found")
    data = await file.read()
    if len(data) > settings.max_child_photo_bytes:
        raise HTTPException(status_code=400, detail="הקובץ גדול מדי (מקסימום 2MB)")
    ext = _detect_image_format(data)
    CHILD_MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    if child.photo_filename:
        _unlink_child_photo(child.photo_filename)
    fname = f"{child_id}.{ext}"
    out_path = CHILD_MEDIA_DIR / fname
    out_path.write_bytes(data)
    child.photo_filename = fname
    log_action(db, user, "child.photo", target=f"child:{child_id}")
    db.commit()
    db.refresh(child)
    return child_to_out(child)


@router.delete("/{child_id}/photo", response_model=ChildOut)
def delete_child_photo(
    child_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_parent),
) -> ChildOut:
    child = db.get(Child, child_id)
    if child is None or child.family_id != user.family_id:
        raise HTTPException(status_code=404, detail="Child not found")
    _unlink_child_photo(child.photo_filename)
    child.photo_filename = None
    log_action(db, user, "child.photo_delete", target=f"child:{child_id}")
    db.commit()
    db.refresh(child)
    return child_to_out(child)
