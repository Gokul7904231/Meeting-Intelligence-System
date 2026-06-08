from __future__ import annotations

from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ErrorDetail(BaseModel):
    code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable error message")


class UnifiedSuccessResponse(BaseModel, Generic[T]):
    traceId: str
    success: bool = True
    data: T


class UnifiedErrorResponse(BaseModel):
    traceId: str
    success: bool = False
    error: ErrorDetail


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    page: int
    pageSize: int
    total: int


class TraceRequestContext(BaseModel):
    traceId: str


def build_success(trace_id: str, data: Any) -> dict[str, Any]:
    return {"traceId": trace_id, "success": True, "data": data}


def build_error(trace_id: str, code: str, message: str) -> dict[str, Any]:
    return {
        "traceId": trace_id,
        "success": False,
        "error": {"code": code, "message": message},
    }

