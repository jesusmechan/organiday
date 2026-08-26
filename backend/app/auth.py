from datetime import datetime, timedelta, timezone
import base64
import hashlib
import hmac
import os
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from . import models
from .config import settings
from .database import get_db
from .generator import uid

bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return f"pbkdf2${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt_b64, digest_b64 = stored.split("$", 2)
    except ValueError:
        return False
    if scheme != "pbkdf2":
        return False
    salt = base64.b64decode(salt_b64)
    expected = base64.b64decode(digest_b64)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return hmac.compare_digest(digest, expected)


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def create_access_token(user: models.User) -> str:
    payload = {
        "sub": user.id,
        "email": user.email,
        "typ": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def issue_refresh_token(db: Session, user: models.User) -> str:
    raw = base64.urlsafe_b64encode(os.urandom(48)).decode("utf-8").rstrip("=")
    expires = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_days)
    db.add(
        models.RefreshToken(
            id=uid("rft"),
            token_hash=hash_refresh_token(raw),
            expires_at=expires.isoformat(),
            revoked=False,
            user_id=user.id,
        )
    )
    db.commit()
    return raw


def issue_tokens(db: Session, user: models.User) -> tuple[str, str]:
    return create_access_token(user), issue_refresh_token(db, user)


def _parse_expiry(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def resolve_refresh_token(db: Session, raw: str) -> models.RefreshToken | None:
    if not raw.strip():
        return None
    row = (
        db.query(models.RefreshToken)
        .filter(models.RefreshToken.token_hash == hash_refresh_token(raw.strip()))
        .first()
    )
    if not row or row.revoked:
        return None
    if _parse_expiry(row.expires_at) <= datetime.now(timezone.utc):
        row.revoked = True
        db.commit()
        return None
    return row


def rotate_refresh_token(db: Session, raw: str) -> tuple[models.User, str, str] | None:
    row = resolve_refresh_token(db, raw)
    if not row:
        return None
    user = db.query(models.User).filter(models.User.id == row.user_id).first()
    if not user:
        return None
    row.revoked = True
    db.commit()
    access, refresh = issue_tokens(db, user)
    return user, access, refresh


def revoke_refresh_token(db: Session, raw: str) -> None:
    row = resolve_refresh_token(db, raw)
    if not row:
        return
    row.revoked = True
    db.commit()


def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> models.User:
    if not creds:
        raise HTTPException(status_code=401, detail="Inicia sesión para continuar.")
    try:
        data = jwt.decode(creds.credentials, settings.secret_key, algorithms=["HS256"])
    except jwt.PyJWTError as error:
        raise HTTPException(status_code=401, detail="Sesión inválida o vencida.") from error
    if data.get("typ") != "access":
        raise HTTPException(status_code=401, detail="Sesión inválida o vencida.")
    user = db.query(models.User).filter(models.User.id == data.get("sub")).first()
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado.")
    return user
