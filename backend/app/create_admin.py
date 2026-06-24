import argparse
import secrets

from sqlalchemy import select

from .config import get_settings
from .database import Base, SessionLocal, engine
from .models import StakeholderGroup, User
from .security import hash_password
from .seed import seed_database


def ensure_production_secret() -> None:
    settings = get_settings()
    production_mode = settings.app_mode.lower() == "production" or settings.app_env.lower() == "production"
    insecure_secrets = {"", "change-this-secret-in-production", "local-development-secret"}
    if production_mode and settings.secret_key.strip() in insecure_secrets:
        raise SystemExit("SECRET_KEY must be changed before creating a production administrator.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create or reset a platform administrator.")
    parser.add_argument("--email", required=True, help="Administrator email address.")
    parser.add_argument("--name", required=True, help="Administrator display name.")
    parser.add_argument(
        "--role",
        default="super_admin",
        choices=["super_admin", "admin", "reviewer"],
        help="Administrator role. Defaults to super_admin.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    ensure_production_secret()
    Base.metadata.create_all(bind=engine)

    temporary_password = secrets.token_urlsafe(24)
    with SessionLocal() as db:
        seed_database(db)
        stakeholder_group = db.scalar(
            select(StakeholderGroup).where(StakeholderGroup.code == "teacher")
        ) or db.scalar(select(StakeholderGroup).order_by(StakeholderGroup.id))
        user = db.scalar(select(User).where(User.email == args.email))
        if user:
            user.name = args.name
            user.role = args.role
            user.password_hash = hash_password(temporary_password)
            user.is_active = True
            user.force_password_change = True
            if stakeholder_group and user.stakeholder_group_id is None:
                user.stakeholder_group_id = stakeholder_group.id
            action = "reset"
        else:
            user = User(
                email=args.email,
                name=args.name,
                role=args.role,
                password_hash=hash_password(temporary_password),
                stakeholder_group_id=stakeholder_group.id if stakeholder_group else None,
                is_active=True,
                force_password_change=True,
            )
            db.add(user)
            action = "created"
        db.commit()

    print(f"Administrator {action}: {args.email}")
    print(f"Role: {args.role}")
    print(f"Temporary password: {temporary_password}")
    print("force_password_change=true")


if __name__ == "__main__":
    main()
