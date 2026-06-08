# TODO - Meeting Intelligence Service

- [x] Initialize project structure (app/, tests/, docs/), requirements.txt, .env.example, Dockerfile
- [x] Implement FastAPI app bootstrap (main.py), CORS, health endpoint, centralized exception handling
- [x] Add unified response schemas + request trace middleware (Trace IDs)
- [x] Implement authentication (JWT) + auth dependency
- [x] Implement DB layer: SQLAlchemy engine/session + ORM models (User, Meeting, ActionItem)
- [x] Implement Pydantic schemas for meetings/action items/AI analysis
- [x] Implement meeting CRUD + list pagination endpoints
- [x] Implement action item CRUD, status updates, overdue query
- [x] Implement AI analysis endpoint with grounded citations (timestamp mapping)
- [x] Implement background scheduler job to find overdue items and notify via notifier integration
- [x] Implement notifier integration (Slack/Discord/Email via webhook/SMTP stub)
- [x] Add OpenAPI metadata + tags/operation summaries
- [x] Add basic unit/integration tests
- [x] Add docs (README.md, AI_APPROACH.md, CHECKLIST.md, DECISIONS.md, TESTING.md)
- [x] Run formatting/lint/tests via commands
