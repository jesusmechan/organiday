from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import (
    get_current_user,
    hash_password,
    issue_tokens,
    revoke_refresh_token,
    rotate_refresh_token,
    verify_password,
)
from ..database import get_db
from ..generator import now_iso, uid
from ..services import claim_orphan_data

router = APIRouter()


def normalize_email(value: str) -> str:
    return value.strip().lower()


def to_user_out(user: models.User) -> schemas.UserOut:
    return schemas.UserOut(id=user.id, name=user.name, email=user.email)


def to_token_out(user: models.User, access: str, refresh: str) -> schemas.TokenOut:
    return schemas.TokenOut(access_token=access, refresh_token=refresh, user=to_user_out(user))


@router.post(
    "/register",
    response_model=schemas.TokenOut,
    tags=["Cuenta"],
    summary="Crear una cuenta",
    status_code=201,
)
def register(payload: schemas.RegisterIn, db: Session = Depends(get_db)):
    name = payload.name.strip()
    email = normalize_email(payload.email)
    password = payload.password
    if not name:
        raise HTTPException(status_code=400, detail="Escribe tu nombre.")
    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="El correo no es válido.")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres.")
    exists = db.query(models.User).filter(models.User.email == email).first()
    if exists:
        raise HTTPException(status_code=409, detail="Ese correo ya tiene una cuenta.")
    user = models.User(
        id=uid("usr"),
        name=name,
        email=email,
        password_hash=hash_password(password),
        created_at=now_iso(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    claim_orphan_data(db, user.id)
    access, refresh = issue_tokens(db, user)
    return to_token_out(user, access, refresh)


@router.post(
    "/login",
    response_model=schemas.TokenOut,
    tags=["Cuenta"],
    summary="Iniciar sesión",
)
def login(payload: schemas.LoginIn, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos.")
    access, refresh = issue_tokens(db, user)
    return to_token_out(user, access, refresh)


@router.post(
    "/refresh",
    response_model=schemas.TokenOut,
    tags=["Cuenta"],
    summary="Renovar la sesión con un refresh token",
)
def refresh(payload: schemas.RefreshIn, db: Session = Depends(get_db)):
    rotated = rotate_refresh_token(db, payload.refresh_token)
    if not rotated:
        raise HTTPException(status_code=401, detail="Sesión vencida. Entra de nuevo.")
    user, access, refresh_token = rotated
    return to_token_out(user, access, refresh_token)


@router.post(
    "/logout",
    response_model=schemas.OkOut,
    tags=["Cuenta"],
    summary="Cerrar sesión y anular el refresh token",
)
def logout(payload: schemas.RefreshIn, db: Session = Depends(get_db)):
    revoke_refresh_token(db, payload.refresh_token)
    return {"ok": True}


@router.get(
    "/me",
    response_model=schemas.UserOut,
    tags=["Cuenta"],
    summary="Ver la cuenta actual",
)
def me(user: models.User = Depends(get_current_user)):
    return to_user_out(user)
