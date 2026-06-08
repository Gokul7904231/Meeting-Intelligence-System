from __future__ import annotations

from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient


def test_health_endpoint(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    assert json_data["data"]["status"] == "UP"
    assert "traceId" in json_data
    assert response.headers.get("X-Trace-ID") == json_data["traceId"]


def test_evaluation_endpoint(client: TestClient):
    response = client.get("/api/evaluation")
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    assert json_data["data"]["candidateName"] == "Gokul A"
    assert json_data["data"]["externalIntegration"] == "Discord Webhook"
    assert "traceId" in json_data


def test_user_flow_and_auth(client: TestClient):
    # 1. Register a new user
    reg_payload = {"email": "test@hintro.com", "password": "securepassword"}
    response = client.post("/auth/register", json=reg_payload)
    assert response.status_code == 200
    reg_json = response.json()
    assert reg_json["success"] is True
    assert reg_json["data"]["email"] == "test@hintro.com"
    assert isinstance(reg_json["data"]["id"], int)

    # Try duplicate registration
    dup_response = client.post("/auth/register", json=reg_payload)
    assert dup_response.status_code == 400
    dup_json = dup_response.json()
    assert dup_json["success"] is False
    assert dup_json["error"]["code"] == "bad_request"

    # 2. Login user
    login_payload = {"email": "test@hintro.com", "password": "securepassword"}
    response = client.post("/auth/login", json=login_payload)
    assert response.status_code == 200
    login_json = response.json()
    assert login_json["success"] is True
    assert "access_token" in login_json["data"]
    assert isinstance(login_json["data"]["userId"], int)


def test_meeting_and_action_item_flow(client: TestClient):
    # Register and login to get auth token
    user_payload = {"email": "user@hintro.com", "password": "mypassword"}
    client.post("/auth/register", json=user_payload)
    login_res = client.post("/auth/login", json=user_payload).json()
    token = login_res["data"]["access_token"]
    user_id = login_res["data"]["userId"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create a meeting
    meeting_date = datetime.now(timezone.utc)
    meeting_payload = {
        "title": "Weekly Sync",
        "userId": user_id,
        "meetingDate": meeting_date.isoformat(),
        "transcript": [
            {"timestamp": "00:10", "speaker": "Alice", "text": "We need to deploy the API by Friday."},
            {"timestamp": "00:20", "speaker": "Bob", "text": "I will handle the Docker configuration."},
            {"timestamp": "00:30", "speaker": "Alice", "text": "Great, let's decide to use Render."}
        ]
    }
    
    response = client.post("/meetings", json=meeting_payload, headers=headers)
    assert response.status_code == 200
    meeting_json = response.json()
    assert meeting_json["success"] is True
    meeting_id = meeting_json["data"]["id"]
    assert isinstance(meeting_id, int)
    assert meeting_json["data"]["title"] == "Weekly Sync"

    # Try creating meeting with mismatch organizer (Forbidden)
    bad_meeting = meeting_payload.copy()
    bad_meeting["userId"] = 9999
    forbidden_res = client.post("/meetings", json=bad_meeting, headers=headers)
    assert forbidden_res.status_code == 403

    # 2. Get the meeting details
    get_res = client.get(f"/meetings/{meeting_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["data"]["title"] == "Weekly Sync"

    # 3. List meetings (pagination test)
    list_res = client.get("/meetings?page=1&pageSize=5", headers=headers)
    assert list_res.status_code == 200
    assert len(list_res.json()["data"]["items"]) == 1
    assert list_res.json()["data"]["total"] == 1

    # 4. Create an action item linked to the meeting
    due = datetime.now(timezone.utc) + timedelta(days=2)
    ai_payload = {
        "meetingId": meeting_id,
        "task": "Docker Setup",
        "assignee": "Bob",
        "dueDate": due.isoformat()
    }
    response = client.post("/action-items", json=ai_payload, headers=headers)
    assert response.status_code == 200
    ai_json = response.json()
    assert ai_json["success"] is True
    ai_id = ai_json["data"]["id"]
    assert isinstance(ai_id, int)
    assert ai_json["data"]["status"] == "PENDING"

    # 5. List action items (with filter)
    list_ai = client.get(f"/action-items?meetingId={meeting_id}", headers=headers)
    assert list_ai.status_code == 200
    assert len(list_ai.json()["data"]) == 1

    # 6. Update action item status
    update_payload = {"status": "COMPLETED", "dueDate": None}
    up_res = client.put(f"/action-items/{ai_id}", json=update_payload, headers=headers)
    assert up_res.status_code == 200
    assert up_res.json()["data"]["status"] == "COMPLETED"

    # 7. Create an overdue action item (due in the past)
    past_due = datetime.now(timezone.utc) - timedelta(hours=5)
    overdue_payload = {
        "meetingId": meeting_id,
        "task": "Old Task",
        "assignee": "Alice",
        "dueDate": past_due.isoformat()
    }
    response = client.post("/action-items", json=overdue_payload, headers=headers)
    overdue_id = response.json()["data"]["id"]

    # 8. List overdue action items
    overdue_res = client.get("/action-items/overdue", headers=headers)
    assert overdue_res.status_code == 200
    overdue_list = overdue_res.json()["data"]
    # Only "Old Task" is overdue since Docker Setup was marked as COMPLETED
    assert len(overdue_list) == 1
    assert overdue_list[0]["id"] == overdue_id


def test_ai_analysis_endpoint(client: TestClient):
    # Register and login to get auth token
    user_payload = {"email": "ai@hintro.com", "password": "mypassword"}
    client.post("/auth/register", json=user_payload)
    login_res = client.post("/auth/login", json=user_payload).json()
    token = login_res["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Prepare analysis payload
    analysis_payload = {
        "transcript": [
            {"timestamp": "00:10", "speaker": "Alice", "text": "We must choose a framework. I decide we go with FastAPI."},
            {"timestamp": "01:20", "speaker": "Bob", "text": "Ok, I will need to set up the DB models by tomorrow."}
        ],
        "focus": "database and framework decisions"
    }

    # Perform analysis
    response = client.post("/ai/analyze", json=analysis_payload, headers=headers)
    assert response.status_code == 200
    analysis_json = response.json()
    assert analysis_json["success"] is True
    
    data = analysis_json["data"]
    assert "summary" in data
    assert "decisions" in data
    assert "actionItems" in data
    assert "followUps" in data
    
    # Assert citation structure in all outputs
    for pt in data["summary"]:
        assert isinstance(pt["citations"], list)
        assert len(pt["citations"]) > 0
    for dec in data["decisions"]:
        assert isinstance(dec["citations"], list)
        assert len(dec["citations"]) > 0
    for ai_item in data["actionItems"]:
        assert isinstance(ai_item["citations"], list)
        assert len(ai_item["citations"]) > 0


def test_validation_error_unified_format(client: TestClient):
    # Intentionally providing invalid email format
    response = client.post("/auth/register", json={"email": "invalid-email"})
    assert response.status_code == 422
    json_data = response.json()
    assert json_data["success"] is False
    assert json_data["error"]["code"] == "validation_error"
    assert "traceId" in json_data
