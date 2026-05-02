from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from .models import Child, Role

NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
PrizeNameStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
UsernameStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60)]
PasswordStr = Annotated[str, StringConstraints(min_length=4, max_length=200)]


class FamilyRegister(BaseModel):
    family_name: NonEmptyStr
    admin_username: UsernameStr
    admin_display_name: NonEmptyStr
    admin_password: PasswordStr


class LoginRequest(BaseModel):
    family_id: int
    username: UsernameStr
    password: PasswordStr


class FamilyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    created_at: datetime


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    family_id: int
    username: str
    display_name: str
    role: Role
    linked_child_id: int | None
    created_at: datetime


class UserCreate(BaseModel):
    username: UsernameStr
    display_name: NonEmptyStr
    password: PasswordStr
    role: Role = Role.parent
    linked_child_id: int | None = None


class UserUpdate(BaseModel):
    display_name: NonEmptyStr | None = None
    role: Role | None = None
    linked_child_id: int | None = None
    password: PasswordStr | None = None


class ChildOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    family_id: int
    name: str
    stars: int
    created_at: datetime
    photo_url: str | None = None


def child_to_out(child: Child) -> ChildOut:
    photo_url = f"/media/children/{child.photo_filename}" if child.photo_filename else None
    return ChildOut(
        id=child.id,
        family_id=child.family_id,
        name=child.name,
        stars=child.stars,
        created_at=child.created_at,
        photo_url=photo_url,
    )


class ChildCreate(BaseModel):
    name: NonEmptyStr


class ChildUpdate(BaseModel):
    name: NonEmptyStr | None = None


class StarChange(BaseModel):
    delta: int = Field(ge=-100, le=100)
    reason: str | None = Field(default=None, max_length=255)


class StarEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    child_id: int
    delta: int
    reason: str | None
    actor_user_id: int | None
    created_at: datetime


class WeekResetRequest(BaseModel):
    confirm: bool = False


class PrizeCreate(BaseModel):
    name: PrizeNameStr
    cost_stars: int = Field(ge=1, le=10_000)


class PrizeUpdate(BaseModel):
    name: PrizeNameStr | None = None
    cost_stars: int | None = Field(default=None, ge=1, le=10_000)


class PrizeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    family_id: int
    name: str
    cost_stars: int
    sort_order: int
    created_at: datetime


class RedeemPrizeRequest(BaseModel):
    child_id: int = Field(ge=1)


class PrizeRedemptionOut(BaseModel):
    id: int
    child_id: int
    child_name: str
    prize_name: str
    cost_stars: int
    created_at: datetime


class MeResponse(BaseModel):
    user: UserOut
    family: FamilyOut
