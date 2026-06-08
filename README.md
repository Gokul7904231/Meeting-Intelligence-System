# Hintro Meeting Intelligence Service

Hintro is a premium, high-end meeting intelligence service featuring an **Elegant Fluid Monochrome** dashboard interface. It ingests meeting audio transcripts, performs AI-powered summarization and citation grounding using the Gemini API, tracks action items, and schedules webhook notifications for overdue deliverables.

---

## 📁 Repository Structure
```text
Meeting Intelligence Service/
├── app/                      # FastAPI Backend Application
│   ├── api/                  # Routers & API Dependencies
│   ├── core/                 # Config & Logger setup
│   ├── db/                   # Database schemas and SQLAlchemy setup
│   ├── integrations/         # Webhook integrations (Slack & Discord)
│   ├── schemas/              # Pydantic schemas (common wrappers)
│   ├── services/             # Business & AI parsing services
│   └── tasks/                # Scheduled background jobs (overdue checker)
├── docs/                     # Additional architectural guides
├── frontend/                 # React (Vite + Tailwind CSS) Dashboard
│   ├── src/                  # Components, Styles, and Hooks
│   └── index.html            # Main HTML layout wrapper
├── tests/                    # Pytest backend integration test suites
├── Dockerfile                # Multi-stage production build configuration
├── requirements.txt          # Python backend dependencies
└── README.md                 # Main Documentation Guide
```

---

## ⚙️ Environment Variables (`.env`)
Create a `.env` file in the root directory of the repository with the following configurations:

```env
# Application Settings
APP_NAME="Hintro Meeting Intelligence"
ENVIRONMENT="development"
PORT=8000

# Security (JWT token generation)
SECRET_KEY="your-hex-encoded-secret-key"
ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Database Engine
DATABASE_URL="sqlite:///./test.db"

# AI Grounding Key (Gemini API Key)
GEMINI_API_KEY="AIzaSy..."

# Third-party Integrations (Incoming Webhooks)
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
```

---

## 🚀 Local Execution

### 1. Prerequisites
* Python 3.10+
* Node.js 18+ and npm

### 2. Backend Setup & Run
From the project root:
```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run backend server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The FastAPI server will be active at `http://127.0.0.1:8000`. The interactive Swagger API documentation will be accessible at `http://127.0.0.1:8000/docs`.

### 3. Frontend Setup & Run
From the `frontend` folder:
```bash
# 1. Install packages
npm install

# 2. Start Vite development server
npm run dev
```
The React application will be served at `http://localhost:5173/` (or the next available port, e.g., `5174`).

---

## 🧪 Verification & Testing
To execute backend validation tests:
```bash
python -m pytest
```

---

## 🐳 Docker Production Build
To containerize and run the service:
```bash
# Build Docker image
docker build -t hintro-service .

# Run Docker container
docker run -p 8000:8000 --env-file .env hintro-service
```

---

## 📡 API Usage & Response Formats

### 1. Unified JSON Envelope
The application enforces a strict response structure for all endpoints:

* **Success Envelope** (`200 OK`, `201 Created`):
  ```json
  {
    "traceId": "9f2b8c1a",
    "success": true,
    "data": {
      "items": []
    }
  }
  ```
* **Error Envelope** (`400 Bad Request`, `401 Unauthorized`, `422 Unprocessable Entity`, `500 Server Error`):
  ```json
  {
    "traceId": "d5c3e2f1",
    "success": false,
    "error": {
      "code": "validation_error",
      "message": "field required: email"
    }
  }
  ```

### 2. Principal Endpoints

#### Authentication
* **Register**: `POST /auth/register`
  * Request: `{"email": "gokul@company.com", "password": "securepassword"}`
* **Login**: `POST /auth/login`
  * Request: `{"email": "gokul@company.com", "password": "securepassword"}`
  * Response Data: `{"access_token": "...", "token_type": "bearer", "userId": 1}`

#### Meetings & AI Ingestion
* **Ingest & Analyze**: `POST /meetings`
  * Requires `Authorization: Bearer <token>`
  * Request:
    ```json
    {
      "title": "Sync Sync",
      "userId": 1,
      "meetingDate": "2026-06-08T22:30:00Z",
      "transcript": [
        {"timestamp": "00:10", "speaker": "Alice", "text": "Let's use Render for deployment."},
        {"timestamp": "02:00", "speaker": "Bob", "text": "Sounds good. Follow up on security next week."}
      ]
    }
    ```

#### Action Items Tracking
* **Fetch Action Items**: `GET /action-items`
* **Update Status**: `PUT /action-items/{id}`
  * Request: `{"status": "COMPLETED"}` (values: `PENDING`, `IN_PROGRESS`, `COMPLETED`)
