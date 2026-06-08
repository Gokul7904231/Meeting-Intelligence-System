from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field


class MeetingCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    userId: int
    meetingDate: datetime
    transcript: list[dict[str, Any]] = Field(
        ..., description="Array of {timestamp, speaker, text} objects"
    )


class MeetingOut(BaseModel):
    id: int
    title: str
    userId: int
    meetingDate: datetime
    transcript: list[dict[str, Any]]


class MeetingListQuery(BaseModel):
    page: int = Field(default=1, ge=1)
    pageSize: int = Field(default=20, ge=1, le=100)


class MeetingAnalysisIn(BaseModel):
    transcript: list[dict[str, Any]] = Field(
        ..., description="Array of {timestamp, speaker, text} objects"
    )
    focus: Optional[str] = Field(default=None, max_length=1000)
