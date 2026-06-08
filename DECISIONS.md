# Technical Decisions & Architecture - DECISIONS.md

This document details the architectural choices, alternatives considered, and trade-offs made during the development of the Hintro Meeting Intelligence Service.

---

## 💾 1. Database Selection: SQLite with SQLAlchemy ORM
* **Choice**: SQLite database (`test.db`) utilizing SQLAlchemy's asynchronous-ready engine.
* **Why it was chosen**:
  * For development, local runs, and unit testing environments, SQLite provides zero-configuration, self-contained storage.
  * SQLAlchemy abstracts relational configurations so the engine can scale directly to production-grade PostgreSQL by modifying the `DATABASE_URL` connection string without changing the database schema code.
* **Alternatives Considered**:
  * **MongoDB**: A document-oriented schema would allow raw transcripts of varying sizes to be dumped easily.
  * **PostgreSQL (Direct)**: While robust, requiring PostgreSQL to run locally on development environments adds setup friction for evaluation runs.
* **Trade-offs**: SQLite does not support highly concurrent concurrent writes and lacks robust built-in array datatypes (transcripts are serialized as JSON strings in column mapping), but for lightweight operations and stateless deployments, the simplified setup represents a huge efficiency gain.

---

## 🔑 2. Authentication Strategy: JWT (JSON Web Tokens)
* **Choice**: Stateless Bearer tokens hashed using the `HS256` HMAC-SHA256 signature algorithm.
* **Why it was chosen**:
  * Stateless sessions eliminate the need to store session states in the database or maintain a Redis backend session storage, allowing FastAPI to remain highly scaleable.
  * Tokens store simple client payloads (e.g., `user_id` and expiry) directly inside the browser, parsed dynamically on every endpoint request.
* **Alternatives Considered**:
  * **Stateful Sessions & Cookies**: Standard cookies store session IDs mapped to a database table. This makes session revocation simple, but adds database latency and CORS complexity for cross-domain calls.
* **Trade-offs**: Revoking tokens before their expiry limit (30 minutes) requires implementing a token blacklist (e.g., using Redis). We decided the 30-minute automatic expiry window satisfies the security parameters without adding the complexity of session storage.

---

## 💬 3. Third-Party Webhooks: Discord & Slack
* **Choice**: Dual integration for both Slack incoming blocks and Discord rich card webhooks.
* **Why it was chosen**:
  * Both platforms are widely used inside engineering organizations. Webhooks provide instant delivery without requiring OAuth credential setups or complex notification message queues.
  * The scheduler job checks for either `DISCORD_WEBHOOK_URL` or `SLACK_WEBHOOK_URL` and formats payloads dynamically according to each platform's layout constraints.
* **Alternatives Considered**:
  * **SMTP E-mail Alerts**: E-mail is formal but slower and requires setting up SMTP server credentials which can be easily blocked or trigger spam tags.
* **Trade-offs**: Webhooks are unidirectional; we cannot fetch read receipts from the platforms, but for instant alert notification logs, it is the most reliable approach.

---

## 🏗️ 4. Project Structure & Organization
* **Choice**: Standard three-tier monolithic architecture separating models (database schemas), routes (API entrypoints), and business logic (services).
* **Why it was chosen**:
  * Makes codebase exploration logical.
  * Separates validation layer (Pydantic) from database entities (SQLAlchemy Models), preventing schema contamination.
* **Alternatives Considered**:
  * **Domain-Driven Directory Layout**: Separating files by subdomain (e.g., `auth/`, `meetings/` containing their own models/routers). We opted for a grouped layer structure because the scope of the app is concise and fits well into the unified layers pattern.
