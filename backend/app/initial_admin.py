from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import get_settings
from .models import AuditLog, StakeholderGroup, User
from .security import hash_password


WEAK_INITIAL_ADMIN_PASSWORDS = {
    "admin123",
    "password",
    "12345678",
    "test1234",
    "admin",
    "administrator",
    "password123",
    "qwerty123",
}


def validate_initial_admin_password(password: str | None) -> str:
    value = (password or "").strip()
    if not value:
        raise RuntimeError("INITIAL_ADMIN_PASSWORD is required when INITIAL_ADMIN_ENABLED=true.")
    if value.lower() in WEAK_INITIAL_ADMIN_PASSWORDS:
        raise RuntimeError("INITIAL_ADMIN_PASSWORD is too weak. Use a strong password stored only in Render Environment Variables.")
    if len(value) < 12:
        raise RuntimeError("INITIAL_ADMIN_PASSWORD must be at least 12 characters long.")
    return value


def initialize_admin_from_env(db: Session) -> User | None:
    settings = get_settings()
    if not settings.initial_admin_enabled:
        return None

    password = validate_initial_admin_password(settings.initial_admin_password)
    email = (settings.initial_admin_email or "").strip().lower()
    if not email:
        raise RuntimeError("INITIAL_ADMIN_EMAIL is required when INITIAL_ADMIN_ENABLED=true.")

    existing = db.scalar(select(User).where(func.lower(User.email) == email))
    if existing:
        if settings.reset_initial_admin_password:
            existing.password_hash = hash_password(password)
            existing.force_password_change = settings.initial_admin_force_password_change
            existing.is_active = True
            db.add(
                AuditLog(
                    action="reset_initial_admin_password",
                    resource_type="user",
                    resource_id=str(existing.id),
                    detail=f"Initial admin password reset for {email}",
                )
            )
            db.commit()
        return existing

    first_admin_exists = db.scalar(
        select(User.id)
        .where(User.role.in_(["super_admin", "admin", "reviewer"]))
        .limit(1)
    )
    if first_admin_exists:
        raise RuntimeError("INITIAL_ADMIN_ENABLED can only create the first administrator. Disable it or create additional admins from the admin UI.")

    stakeholder_group = db.scalar(
        select(StakeholderGroup).where(StakeholderGroup.code == "teacher")
    ) or db.scalar(select(StakeholderGroup).order_by(StakeholderGroup.id))
    user = User(
        email=email,
        name=(settings.initial_admin_name or "Administrator").strip(),
        password_hash=hash_password(password),
        role="super_admin",
        stakeholder_group_id=stakeholder_group.id if stakeholder_group else None,
        is_active=True,
        force_password_change=settings.initial_admin_force_password_change,
    )
    db.add(user)
    db.flush()
    db.add(
        AuditLog(
            action="create_initial_admin",
            resource_type="user",
            resource_id=str(user.id),
            detail=f"Initial super_admin created for {email}",
        )
    )
    db.commit()
    return user
