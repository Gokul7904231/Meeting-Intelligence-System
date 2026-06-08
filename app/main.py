from __future__ import annotations

import json
import uuid
import structlog
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logger import configure_logger  # noqa: F401
from app.schemas.common import ErrorDetail, UnifiedErrorResponse
from app.tasks.scheduler import start_scheduler, shutdown_scheduler
from app.api.routes import auth, meetings, action_items, ai
from app.db.database import Base, get_engine
import app.db.models  # noqa: F401

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database tables are created on startup
    Base.metadata.create_all(bind=get_engine())
    # Initialize background scheduler on startup
    start_scheduler()
    yield
    # Cleanup background scheduler on shutdown
    shutdown_scheduler()


app = FastAPI(
    title="Hintro Meeting Intelligence API",
    lifespan=lifespan
)

# Mandatory CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Unified Middleware for Trace IDs and error trapping
@app.middleware("http")
async def unified_response_middleware(request: Request, call_next):
    # Check if a trace ID exists in headers, else generate one
    trace_id = request.headers.get("X-Trace-ID") or request.headers.get("X-Trace-Id") or uuid.uuid4().hex[:8]
    request.state.trace_id = trace_id
    
    # Clear and bind contextvars for structlog
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(traceId=trace_id)
    
    logger.info("Request started", method=request.method, path=request.url.path)
    
    try:
        response = await call_next(request)
        response.headers["X-Trace-ID"] = trace_id
        response.headers["X-Trace-Id"] = trace_id
        logger.info("Request completed", status_code=response.status_code)
        return response
    except Exception as exc:
        logger.error("Request failed", error=str(exc))
        # Centralized Global Error Handler
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "traceId": trace_id,
                "success": False,
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": str(exc)
                }
            }
        )


@app.get("/health")
def health_check(request: Request):
    return {
        "traceId": request.state.trace_id,
        "success": True,
        "data": {"status": "UP"}
    }


@app.get("/api/evaluation")
def evaluation_endpoint(request: Request):
    return {
        "traceId": request.state.trace_id,
        "success": True,
        "data": {
            "candidateName": "Gokul A",
            "email": "gokul@example.com",
            "repositoryUrl": "https://github.com/Gokul-A/Meeting-Intelligence-Service",
            "deployedUrl": "https://hintro-meeting-intelligence.onrender.com",
            "externalIntegration": "Discord Webhook",
            "features": ["Authentication", "AI Analysis with Citations", "Overdue Scheduler"]
        }
    }


# Include Routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(meetings.router, prefix="/meetings", tags=["Meetings"])
app.include_router(action_items.router, prefix="/action-items", tags=["Action Items"])
app.include_router(ai.router, prefix="/ai", tags=["AI Analysis"])


def _trace_id(request: Request) -> str:
    return getattr(request.state, "trace_id", None) or "unknown"


# Exception Handlers to Enforce Unified JSON Format for standard validation/HTTP errors

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    trace_id = _trace_id(request)
    err = UnifiedErrorResponse(
        traceId=trace_id,
        success=False,
        error=ErrorDetail(code="bad_request", message=str(exc) or "Bad request parameters"),
    )
    return JSONResponse(status_code=400, content=json.loads(err.model_dump_json()))


@app.exception_handler(PermissionError)
async def permission_error_handler(request: Request, exc: PermissionError):
    trace_id = _trace_id(request)
    err = UnifiedErrorResponse(
        traceId=trace_id,
        success=False,
        error=ErrorDetail(code="unauthorized", message=str(exc) or "Unauthorized access"),
    )
    return JSONResponse(status_code=401, content=json.loads(err.model_dump_json()))


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    trace_id = _trace_id(request)
    errors_summary = "; ".join([f"{'.'.join(str(loc) for loc in err['loc'])}: {err['msg']}" for err in exc.errors()])
    err = UnifiedErrorResponse(
        traceId=trace_id,
        success=False,
        error=ErrorDetail(code="validation_error", message=errors_summary or "Validation failed"),
    )
    return JSONResponse(status_code=422, content=json.loads(err.model_dump_json()))


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    trace_id = _trace_id(request)
    code_map = {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        422: "validation_error",
    }
    error_code = code_map.get(exc.status_code, "http_error")
    err = UnifiedErrorResponse(
        traceId=trace_id,
        success=False,
        error=ErrorDetail(code=error_code, message=exc.detail),
    )
    return JSONResponse(status_code=exc.status_code, content=json.loads(err.model_dump_json()))
