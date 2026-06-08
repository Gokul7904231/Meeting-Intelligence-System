from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session, get_current_user_id
from app.schemas.action_item import ActionItemCreate, ActionItemUpdate, ActionItemOut
from app.schemas.common import build_success
from app.services import action_item_service

router = APIRouter()


def _serialize_action_item(item) -> dict[str, Any]:
    return {
        "id": item.id,
        "meetingId": item.meeting_id,
        "task": item.task,
        "assignee": item.assignee,
        "status": item.status,
        "dueDate": item.due_date,
        "citations": item.citations
    }


@router.post("")
def create_action_item(
    request: Request,
    payload: ActionItemCreate,
    db: Session = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id)
):
    trace_id = getattr(request.state, "trace_id", "unknown")
    item = action_item_service.create_action_item(db, payload)
    return build_success(trace_id, _serialize_action_item(item))


@router.get("")
def list_action_items(
    request: Request,
    assignee: Optional[str] = Query(default=None),
    meetingId: Optional[int] = Query(default=None),
    db: Session = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id)
):
    trace_id = getattr(request.state, "trace_id", "unknown")
    items = action_item_service.list_action_items(db, assignee, meetingId)
    return build_success(trace_id, [_serialize_action_item(item) for item in items])


@router.get("/overdue")
def list_overdue_action_items(
    request: Request,
    db: Session = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id)
):
    trace_id = getattr(request.state, "trace_id", "unknown")
    items = action_item_service.get_overdue_action_items(db)
    return build_success(trace_id, [_serialize_action_item(item) for item in items])


@router.get("/{item_id}")
def get_action_item(
    request: Request,
    item_id: int,
    db: Session = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id)
):
    trace_id = getattr(request.state, "trace_id", "unknown")
    item = action_item_service.get_action_item(db, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="action_item_not_found"
        )
    return build_success(trace_id, _serialize_action_item(item))


@router.put("/{item_id}")
def update_action_item(
    request: Request,
    item_id: int,
    payload: ActionItemUpdate,
    db: Session = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id)
):
    trace_id = getattr(request.state, "trace_id", "unknown")
    
    valid_statuses = {"PENDING", "IN_PROGRESS", "COMPLETED"}
    if payload.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"invalid_status_value. Must be one of {valid_statuses}"
        )
        
    item = action_item_service.update_action_item(db, item_id, payload)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="action_item_not_found"
        )
    return build_success(trace_id, _serialize_action_item(item))
