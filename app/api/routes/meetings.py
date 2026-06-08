from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session, get_current_user_id
from app.schemas.meeting import MeetingCreate, MeetingOut
from app.schemas.common import build_success
from app.services import meeting_service

router = APIRouter()


def _serialize_meeting(m) -> dict[str, Any]:
    return {
        "id": m.id,
        "title": m.title,
        "userId": m.user_id,
        "meetingDate": m.meeting_date,
        "transcript": m.transcript,
    }


@router.post("")
def create_meeting(
    request: Request,
    payload: MeetingCreate,
    db: Session = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id)
):
    trace_id = getattr(request.state, "trace_id", "unknown")
    
    if payload.userId != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="forbidden_user_mismatch"
        )
        
    meeting = meeting_service.create_meeting(db, payload)
    return build_success(trace_id, _serialize_meeting(meeting))


@router.get("")
def list_meetings(
    request: Request,
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id)
):
    trace_id = getattr(request.state, "trace_id", "unknown")
    
    items, total = meeting_service.list_meetings(db, page, pageSize)
    serialized_items = [_serialize_meeting(m) for m in items]
    
    paginated_data = {
        "items": serialized_items,
        "page": page,
        "pageSize": pageSize,
        "total": total
    }
    return build_success(trace_id, paginated_data)


@router.get("/{meeting_id}")
def get_meeting(
    request: Request,
    meeting_id: int,
    db: Session = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id)
):
    trace_id = getattr(request.state, "trace_id", "unknown")
    
    meeting = meeting_service.get_meeting(db, meeting_id)
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="meeting_not_found"
        )
        
    return build_success(trace_id, _serialize_meeting(meeting))
