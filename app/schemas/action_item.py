from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ActionItemCreate(BaseModel):
    meetingId: int
    task: str = Field(..., min_length=1, max_length=1000)
    assignee: str = Field(..., min_length=1, max_length=200)
    dueDate: datetime


class ActionItemUpdate(BaseModel):
    status: str = Field(..., description="One of PENDING, IN_PROGRESS, COMPLETED")
    dueDate: Optional[datetime] = None


class ActionItemOut(BaseModel):
    id: int
    meetingId: int
    task: str
    assignee: str
    status: str
    dueDate: datetime
    citations: Optional[list[str]] = None
