import base64
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db
from .models import InvitationCode, User


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 210_000)
    return (
        "pbkdf2_sha256$210000$"
        f"{base64.b64encode(salt).decode()}$"
        f"{base64.b64encode(digest).decode()}"
    )


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, rounds, salt_value, digest_value = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_value)
        expected = base64.b64decode(digest_value)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, int(rounds))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: int | None = None, invitation_code_id: int | None = None) -> str:
    settings = get_settings()
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_minutes)
    payload: dict[str, str | datetime] = {"exp": expires}
    if user_id is not None:
        payload["sub"] = f"user:{user_id}"
    elif invitation_code_id is not None:
        payload["sub"] = f"invite:{invitation_code_id}"
    else:
        raise ValueError("user_id or invitation_code_id is required")
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def decode_subject(token: str) -> tuple[str, int]:
    settings = get_settings()
    payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    kind, raw_id = str(payload["sub"]).split(":", 1)
    return kind, int(raw_id)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        kind, subject_id = decode_subject(token)
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise unauthorized
    if kind != "user":
        raise unauthorized
    user = db.scalar(select(User).where(User.id == subject_id, User.is_active.is_(True)))
    if not user:
        raise unauthorized
    return user


def get_current_principal(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User | InvitationCode:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        kind, subject_id = decode_subject(token)
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise unauthorized
    if kind == "user":
        user = db.scalar(select(User).where(User.id == subject_id, User.is_active.is_(True)))
        if user:
            return user
    if kind == "invite":
        invitation = db.scalar(
            select(InvitationCode).where(
                InvitationCode.id == subject_id,
                InvitationCode.is_active.is_(True),
            )
        )
        if invitation:
            return invitation
    raise unauthorized


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in {"super_admin", "admin"}:
        raise HTTPException(status_code=403, detail="Administrator permission required.")
    return user


def require_super_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super administrator permission required.")
    return user


def require_report_viewer(user: User = Depends(get_current_user)) -> User:
    if user.role not in {"super_admin", "admin", "reviewer"}:
        raise HTTPException(status_code=403, detail="Report viewer permission required.")
    return user
