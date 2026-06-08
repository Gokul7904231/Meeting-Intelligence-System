from __future__ import annotations

import os
import json
import logging
from typing import Any, Optional
from pydantic import BaseModel, Field
import httpx

logger = logging.getLogger(__name__)


class ActionItemExtraction(BaseModel):
    task: str = Field(..., description="Actionable task description")
    assignee: str = Field(..., description="Name or identifier of the assignee")
    citations: list[str] = Field(..., description="Explicit list of timestamps from the transcript grounding this action item")


class SummaryPoint(BaseModel):
    text: str = Field(..., description="Key summary point text")
    citations: list[str] = Field(..., description="Explicit list of timestamps grounding this summary point")


class DecisionPoint(BaseModel):
    text: str = Field(..., description="Key decision text")
    citations: list[str] = Field(..., description="Explicit list of timestamps grounding this decision")


class FollowUpPoint(BaseModel):
    text: str = Field(..., description="Follow-up point text")
    citations: list[str] = Field(..., description="Explicit list of timestamps grounding this follow-up")


class MeetingAnalysisResult(BaseModel):
    summary: list[SummaryPoint]
    actionItems: list[ActionItemExtraction]
    decisions: list[DecisionPoint]
    followUps: list[FollowUpPoint]


async def analyze_transcript(
    transcript: list[dict[str, Any]],
    focus: Optional[str] = None
) -> MeetingAnalysisResult:
    """
    Analyzes meeting transcript using Gemini REST API with structured outputs.
    Falls back to a structured rule-based parser if API key is missing.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key or gemini_key == "AIzaSyCwoN-placeholder":  # Avoid running on default placeholders
        logger.warning("GEMINI_API_KEY is not configured. Falling back to local rule-based parser.")
        return _fallback_parser(transcript, focus)

    # Format transcript list into readable text for the prompt context
    transcript_str = "\n".join([f"[{t.get('timestamp', '00:00')}] {t.get('speaker', 'Unknown')}: {t.get('text', '')}" for t in transcript])

    system_prompt = (
        "You are a strict meeting intelligence assistant. Your goal is to extract a summary, "
        "action items, decisions, and follow-up suggestions from the provided transcript.\n\n"
        "CRITICAL REQUIREMENT: Every generated insight or action item MUST be grounded directly in the transcript. "
        "Do not invent items, attendees, or dates. Every single item must contain a 'citations' array "
        "referencing the exact string timestamp (e.g., '00:10') where it was stated.\n\n"
        "You must respond ONLY with a valid JSON object matching this structure:\n"
        "{\n"
        "  \"summary\": [{\"text\": \"...\", \"citations\": [\"00:10\"]}],\n"
        "  \"actionItems\": [{\"task\": \"...\", \"assignee\": \"...\", \"citations\": [\"00:20\"]}],\n"
        "  \"decisions\": [{\"text\": \"...\", \"citations\": [\"00:15\"]}],\n"
        "  \"followUps\": [{\"text\": \"...\", \"citations\": [\"00:30\"]}]\n"
        "}"
    )

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
    
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": f"Transcript:\n{transcript_str}\n\nFocus Area: {focus or 'None'}\n\nPerform analysis now:"
                    }
                ]
            }
        ],
        "systemInstruction": {
            "parts": [
                {
                    "text": system_prompt
                }
            ]
        },
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.0
        }
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=30.0)
            response.raise_for_status()
            result = response.json()
            
        raw_content = result["candidates"][0]["content"]["parts"][0]["text"]
        parsed_json = json.loads(raw_content)
        return MeetingAnalysisResult.model_validate(parsed_json)

    except Exception as e:
        logger.error(f"Error calling Gemini REST API: {e}. Falling back to rule-based parser.")
        return _fallback_parser(transcript, focus)


def _fallback_parser(transcript: list[dict[str, Any]], focus: Optional[str] = None) -> MeetingAnalysisResult:
    """
    Rule-based local fallback parser that scans the transcript for action words and
    constructs the structured output.
    """
    summary = []
    action_items = []
    decisions = []
    follow_ups = []

    for index, entry in enumerate(transcript):
        timestamp = entry.get("timestamp", "00:00")
        speaker = entry.get("speaker", "Unknown")
        text = entry.get("text", "")
        text_lower = text.lower()

        # Extract tasks
        action_keywords = ["todo", "action item", "need to", "will handle", "should do", "please do", "task"]
        if any(kw in text_lower for kw in action_keywords):
            # Resolve assignee
            assignee = speaker
            for word in text.split():
                if word[0].isupper() and word.lower() not in ["i", "we", "he", "she", "they", "the", "this"]:
                    assignee = word.strip(",.:")
                    break
            action_items.append(ActionItemExtraction(
                task=text,
                assignee=assignee,
                citations=[timestamp]
            ))

        # Extract decisions
        decision_keywords = ["decide", "agree", "approve", "conclusion", "settled"]
        if any(kw in text_lower for kw in decision_keywords):
            decisions.append(DecisionPoint(
                text=f"{speaker} decided: {text}",
                citations=[timestamp]
            ))

        # Extract follow ups
        follow_keywords = ["follow up", "later", "next time", "schedule a", "meet again", "recommend", "decide", "synchronization", "sync"]
        if any(kw in text_lower for kw in follow_keywords):
            follow_ups.append(FollowUpPoint(
                text=text,
                citations=[timestamp]
            ))

        # General summaries
        if index == 0 or index == len(transcript) - 1 or (index > 0 and index % 3 == 0):
            summary.append(SummaryPoint(
                text=f"{speaker} stated: {text}",
                citations=[timestamp]
            ))

    if not summary:
        summary.append(SummaryPoint(text="No discussion was recorded.", citations=["00:00"]))

    return MeetingAnalysisResult(
        summary=summary,
        actionItems=action_items,
        decisions=decisions,
        followUps=follow_ups
    )
