from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_session, get_current_user_id
from app.schemas.meeting import MeetingAnalysisIn
from app.schemas.common import build_success
from app.services import ai_service, meeting_service

router = APIRouter()


@router.post("/analyze")
async def analyze_meeting_transcript(
    request: Request,
    payload: MeetingAnalysisIn,
    meetingId: Optional[int] = Query(default=None),
    db: Session = Depends(get_db_session),
    current_user_id: int = Depends(get_current_user_id)
):
    trace_id = getattr(request.state, "trace_id", "unknown")
    
    transcript = payload.transcript
    
    # If meetingId is specified, fetch the transcript from the database instead
    if meetingId is not None:
        meeting = meeting_service.get_meeting(db, meetingId)
        if not meeting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="meeting_not_found"
            )
        transcript = meeting.transcript
        
    if not transcript:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="transcript_empty_or_missing"
        )
        
    result = await ai_service.analyze_transcript(transcript, payload.focus)
    return build_success(trace_id, result.model_dump())
