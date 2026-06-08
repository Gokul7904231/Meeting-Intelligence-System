# Testing & QA Strategy - TESTING.md

This document details the test suites, edge case scenarios, manual checklist reviews, and verification metrics used to validate the Hintro Meeting Intelligence Service.

---

## 🧪 1. Automated Test Suite (Pytest)
We implement comprehensive integration tests inside the [`tests/`](file:///c:/Users/ASUS/OneDrive/Desktop/123/Meeting%20Intelligence%20Service/tests) directory. These tests validate endpoints, database integrity, error formats, and security tokens.

### Scenarios Executed
1. **User Authentication Flow (`/auth`)**:
   * Registers a new account and asserts validation on passwords and email formats.
   * Generates a valid HS256 JWT bearer token on login and checks expiration settings.
2. **Meetings Management CRUD (`/meetings`)**:
   * Creates a meeting and asserts the transcription elements store correctly.
   * Tests meeting pagination controls, checking limits and offsets.
3. **AI Transcript Grounding (`/ai/analyze`)**:
   * Submits a transcript structure and validates the JSON output mapping.
   * Asserts the presence of `summary`, `decisions`, `actionItems`, and `followUps`.
   * Verifies that each extracted item contains a valid `citations` array.
4. **Action Items Tracking (`/action-items`)**:
   * Tests state updates (transitions between `PENDING`, `IN_PROGRESS`, and `COMPLETED`).
   * Queries for overdue action items.
5. **Unified Error Pipelines**:
   * Triggers a request validation error (422) and asserts the response maps to the strict success-false JSON envelope and prints a `traceId`.

---

## 🛡️ 2. Edge Cases Handled

* **Stale Token Expiry (401 Interception)**:
  * Tested user authentication with invalid credentials. The frontend catches the 401 error, purges browser storage, and redirects the user back to the login gate immediately, preventing UI locks.
* **Missing API Credentials (AI Fallback)**:
  * Disabled `GEMINI_API_KEY` to verify the local parser. The service handles the missing key smoothly, falling back to keyword extraction without throwing internal server errors (500).
* **Empty Meetings & Deliverables List**:
  * Handled empty data lists by displaying premium vector placeholders and Quick Ingest buttons rather than rendering raw empty containers.

---

## ⚠️ 3. QA and Limitations Discovered
* **Scheduler Latency**: The overdue scanner runs on a periodic interval (configured via APScheduler). If an action item becomes overdue immediately after a scan, the integration webhooks (Discord/Slack) will only dispatch notifications on the subsequent timer loop.
* **Initials Parsing**: User initials are parsed from email strings. Emails starting with special characters fallback to a default `'U'` icon.
