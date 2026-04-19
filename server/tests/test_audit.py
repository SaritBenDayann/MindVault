import pytest
import os
import sys
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
from zoneinfo import ZoneInfo
from app import create_app

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from services.audit_service import log_audit_event, get_recent_audit_logs

@pytest.fixture
def app():
    app = create_app()
    app.config.update({"TESTING": True})
    return app

# ==========================================
# Group 1: Logging Logic & Enrichment
# ==========================================

@patch('services.audit_service._get_audit_collection')
def test_log_event_basic_persistence(mock_coll):
    mock_db = MagicMock()
    mock_coll.return_value = mock_db
    log_audit_event("test@user.com", "login_attempt")
    assert mock_db.insert_one.called

@patch('services.audit_service._get_audit_collection')
@patch('services.audit_service.has_request_context', return_value=True)
def test_log_event_ip_enrichment(mock_has_ctx, mock_coll, app):
    mock_db = MagicMock()
    mock_coll.return_value = mock_db
    
    with app.test_request_context(headers={"X-Forwarded-For": "1.2.3.4"}):
        log_audit_event("test@user.com", "action")
        saved_doc = mock_db.insert_one.call_args[0][0]
        assert saved_doc["details"]["ip"] == "1.2.3.4"

@patch('services.audit_service._get_audit_collection')
@patch('services.audit_service.has_request_context', return_value=True)
def test_log_event_user_agent_enrichment(mock_has_ctx, mock_coll, app):
    mock_db = MagicMock()
    mock_coll.return_value = mock_db
    
    with app.test_request_context(headers={"User-Agent": "MindVaultBot"}):
        log_audit_event("u@e.com", "act")
        saved_doc = mock_db.insert_one.call_args[0][0]
        assert saved_doc["details"]["user_agent"] == "MindVaultBot"

# ==========================================
# Group 2: Retrieval & Sorting (Fixing the Cursor Chain)
# ==========================================

# Helper to mock the find().sort().limit() chain correctly
def setup_mock_cursor(mock_coll, data_list):
    mock_cursor = MagicMock()
    # This makes the cursor iterable so it returns our data in the loop
    mock_cursor.__iter__.return_value = iter(data_list)
    mock_coll.return_value.find.return_value.sort.return_value.limit.return_value = mock_cursor

@patch('services.audit_service._get_audit_collection')
def test_timestamp_conversion_to_jerusalem(mock_coll):
    utc_now = datetime(2026, 1, 1, 12, 0, 0, tzinfo=ZoneInfo("UTC"))
    mock_doc = {"_id": "123", "user_email": "a@b.com", "action": "test", "timestamp": utc_now}
    setup_mock_cursor(mock_coll, [mock_doc])
    
    logs = get_recent_audit_logs()
    assert "2026-01-01T14:00:00" in logs[0]["timestamp"]

@patch('services.audit_service._get_audit_collection')
def test_user_email_fallback_priority(mock_coll):
    mock_doc = {"_id": "1", "user": "middle@user.com", "user_email": "top@user.com"}
    setup_mock_cursor(mock_coll, [mock_doc])
    
    logs = get_recent_audit_logs()
    assert logs[0]["user"] == "top@user.com"

# ==========================================
# Group 3: API Routes (Now with App Fixture)
# ==========================================

def test_route_get_all_audit_logs(client):
    with patch('services.audit_service.get_recent_audit_logs', return_value=[{"id": "1"}]):
        response = client.get("/audit-logs")
        assert response.status_code == 200

def test_route_recent_logs_unauthorized(client):
    response = client.get("/audit/logs/recent")
    assert response.status_code == 401

# ==========================================
# Group 4: Hardening
# ==========================================

@patch('services.audit_service._get_audit_collection')
def test_max_log_limit_enforced(mock_coll):
    mock_db = MagicMock()
    mock_coll.return_value = mock_db
    get_recent_audit_logs()
    mock_db.find.return_value.sort.return_value.limit.assert_called_with(1000)