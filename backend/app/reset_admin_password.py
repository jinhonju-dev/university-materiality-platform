import argparse
import secrets

from sqlalchemy import select

from .create_admin import ensure_production_secret
from .database import SessionLocal
from .initial_admin import validate_initial_admin_password
from .models import AuditLog, User
from .security import hash_password


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Reset an administrator password.")
    parser.add_argument("--email", required=True, help="Administrator email address.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    ensure_production_secret()
    temporary_password = secrets.token_urlsafe(24)
    validate_initial_admin_password(temporary_password)

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == args.email, User.role.in_(["super_admin", "admin", "reviewer"])))
        if not user:
            raise SystemExit(f"Administrator not found: {args.email}")
        user.password_hash = hash_password(temporary_password)
        user.force_password_change = True
        user.is_active = True
        db.add(
            AuditLog(
                action="reset_admin_password_cli",
                resource_type="user",
                resource_id=str(user.id),
                detail=f"Administrator password reset from CLI for {args.email}",
            )
        )
        db.commit()

    print(f"Administrator password reset: {args.email}")
    print(f"Temporary password: {temporary_password}")
    print("force_password_change=true")


if __name__ == "__main__":
    main()
