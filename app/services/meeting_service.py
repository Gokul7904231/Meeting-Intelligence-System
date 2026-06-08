from __future__ import annotations

from sqlalchemy.orm import Session
from app.db.models import Meeting
from app.schemas.meeting import MeetingCreate


def create_meeting(db: Session, payload: MeetingCreate) -> Meeting:
    new_meeting = Meeting(
        title=payload.title,
        user_id=payload.userId,
        meeting_date=payload.meetingDate,
        transcript=payload.transcript
    )
    db.add(new_meeting)
    db.commit()
    db.refresh(new_meeting)
    return new_meeting


def get_meeting(db: Session, meeting_id: int) -> Meeting | None:
    return db.query(Meeting).filter(Meeting.id == meeting_id).first()


def list_meetings(db: Session, page: int = 1, page_size: int = 20) -> tuple[list[Meeting], int]:
    offset = (page - 1) * page_size
    query = db.query(Meeting)
    total = query.count()
    items = query.order_by(Meeting.meeting_date.desc()).offset(offset).limit(page_size).all()
    return items, total
