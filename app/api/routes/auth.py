from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session
from app.db.models import User
from app.core.security import hash_password, verify_password, create_access_token
from app.schemas.auth import UserRegister, UserLogin, TokenOut
from app.schemas.common import build_success

router = APIRouter()


@router.post("/register")
def register(request: Request, payload: UserRegister, db: Session = Depends(get_db_session)):
    trace_id = getattr(request.state, "trace_id", "unknown")
    
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="email_already_registered"
        )
    
    # Create new user
    new_user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return build_success(trace_id, {
        "id": new_user.id,
        "email": new_user.email
    })


@router.post("/login")
def login(request: Request, payload: UserLogin, db: Session = Depends(get_db_session)):
    trace_id = getattr(request.state, "trace_id", "unknown")
    
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_credentials"
        )
    
    access_token = create_access_token(subject=str(user.id))
    
    data = TokenOut(
        access_token=access_token,
        token_type="bearer",
        userId=user.id
    )
    
    return build_success(trace_id, data.model_dump())
