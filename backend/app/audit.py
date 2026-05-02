from sqlalchemy.orm import Session

from .models import AuditLog, User


def log_action(
    db: Session,
    actor: User | None,
    action: str,
    target: str | None = None,
    details: str | None = None,
) -> None:
    entry = AuditLog(
        family_id=actor.family_id if actor else None,
        actor_user_id=actor.id if actor else None,
        action=action,
        target=target,
        details=details,
    )
    db.add(entry)
