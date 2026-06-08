from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.db.models import ActionItem
from app.schemas.action_item import ActionItemCreate, ActionItemUpdate


def create_action_item(db: Session, payload: ActionItemCreate) -> ActionItem:
    new_item = ActionItem(
        meeting_id=payload.meetingId,
        task=payload.task,
        assignee=payload.assignee,
        status="PENDING",
        due_date=payload.dueDate,
        citations=None
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item


def get_action_item(db: Session, item_id: int) -> ActionItem | None:
    return db.query(ActionItem).filter(ActionItem.id == item_id).first()


def update_action_item(db: Session, item_id: int, payload: ActionItemUpdate) -> ActionItem | None:
    item = get_action_item(db, item_id)
    if not item:
        return None
        
    item.status = payload.status
    if payload.dueDate is not None:
        item.due_date = payload.dueDate
        
    db.commit()
    db.refresh(item)
    return item


def list_action_items(
    db: Session,
    assignee: str | None = None,
    meeting_id: int | None = None
) -> list[ActionItem]:
    query = db.query(ActionItem)
    if assignee:
        query = query.filter(ActionItem.assignee == assignee)
    if meeting_id is not None:
        query = query.filter(ActionItem.meeting_id == meeting_id)
    return query.order_by(ActionItem.due_date.asc()).all()


def get_overdue_action_items(db: Session) -> list[ActionItem]:
    now = datetime.now(timezone.utc)
    return db.query(ActionItem).filter(
        ActionItem.status != "COMPLETED",
        ActionItem.due_date < now
    ).all()
