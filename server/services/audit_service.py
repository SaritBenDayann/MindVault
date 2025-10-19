from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

# Use the shared Mongo client from the app's DB module
from db.db import db as mongo_db
from zoneinfo import ZoneInfo

# Optional Flask request context helpers (do not fail if not in a request)
try:
    from flask import request as flask_request, has_request_context
except Exception:  # pragma: no cover - available only in app runtime
    flask_request = None  # type: ignore
    def has_request_context() -> bool:  # type: ignore
        return False


def _get_audit_collection():
    """Return the Mongo collection for audit logs, or None if DB unavailable."""
    if mongo_db is None:
        return None
    return mongo_db.get_collection("audit_logs")


def _get_client_ip() -> Optional[str]:
    """Best-effort client IP extraction from the current Flask request."""
    if not has_request_context() or flask_request is None:
        return None
    # Respect common proxy headers if present (take the first public IP)
    xff = flask_request.headers.get("X-Forwarded-For")
    if xff:
        # XFF can be a comma-separated list; take first non-empty
        for part in [p.strip() for p in xff.split(",")]:
            if part:
                return part
    real_ip = flask_request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    return flask_request.remote_addr


def log_audit_event(user_email: str, action: str, details: Optional[Dict[str, Any]] = None) -> None:
    """Persist an audit log entry. No-op if database is unavailable.

    Args:
        user_email: Email of the user performing the action
        action: Short action label (e.g., "Logged in", "Registered")
        details: Optional additional structured context
    """
    collection = _get_audit_collection()
    if collection is None:
        # Offline mode or DB not connected; fail gracefully
        print(f"[audit] (offline) {user_email} - {action} - {details or {}}")
        return

    # Compose structured details and enrich with request metadata when available
    enriched_details: Dict[str, Any] = {}
    if details:
        try:
            if isinstance(details, dict):
                enriched_details.update(details)
        except Exception:
            pass

    client_ip = _get_client_ip()
    if client_ip and "ip" not in enriched_details:
        enriched_details["ip"] = client_ip
    if has_request_context() and flask_request is not None and "user_agent" not in enriched_details:
        ua = flask_request.headers.get("User-Agent")
        if ua:
            enriched_details["user_agent"] = ua

    log_entry = {
        "user_email": user_email or "unknown_user",
        "action": action,
        "details": enriched_details,
        "timestamp": datetime.utcnow(),
    }

    try:
        collection.insert_one(log_entry)
    except Exception as exc:
        # Do not crash the request due to audit logging failures
        print(f"[audit] insert failed: {exc}")


def get_recent_audit_logs(user: Optional[str] = None, days: float = 7) -> List[Dict[str, Any]]:
    """Fetch recent audit logs.

    Args:
        user: Optional user email to filter by
        days: Lookback window in days; if <= 0, returns all available logs

    Returns:
        List of audit logs sorted by most recent first
    """
    collection = _get_audit_collection()
    if collection is None:
        # Offline mode; return empty list rather than failing
        return []

    query: Dict[str, Any] = {}
    if user:
        # Support older documents that may store the user differently
        query = {
            "$or": [
                {"user_email": user},
                {"user": user},
                {"details.user": user},
            ]
        }

    if days > 0:
        since = datetime.utcnow() - timedelta(days=days)
        time_filter = {"timestamp": {"$gte": since}}
        if query:
            query = {"$and": [query, time_filter]}
        else:
            query = time_filter

    try:
        cursor = (
            collection
            .find(query)
            .sort("timestamp", -1)
            .limit(1000)
        )
        logs: List[Dict[str, Any]] = []
        for doc in cursor:
            try:
                details = doc.get("details", {}) or {}

                # Determine user value with fallbacks
                user_value = (
                    doc.get("user_email")
                    or doc.get("user")
                    or (details.get("user") if isinstance(details, dict) else None)
                    or "unknown_user"
                )

                # Determine action value with fallbacks
                action_value = (
                    doc.get("action")
                    or doc.get("event")
                    or doc.get("type")
                    or ""
                )

                # Normalize timestamp to ISO string when possible
                ts = doc.get("timestamp")
                ts_iso: Optional[str]
                if ts is None:
                    ts_iso = None
                else:
                    try:
                        # datetime-like: convert UTC -> Asia/Jerusalem
                        if isinstance(ts, datetime):
                            utc_dt = ts
                            if ts.tzinfo is None:
                                utc_dt = ts.replace(tzinfo=ZoneInfo("UTC"))
                            jerusalem_dt = utc_dt.astimezone(ZoneInfo("Asia/Jerusalem"))
                            ts_iso = jerusalem_dt.isoformat()
                        else:
                            ts_iso = str(ts)  # fallback
                    except Exception:
                        # If already a string or another serializable type
                        if isinstance(ts, str):
                            ts_iso = ts
                        else:
                            try:
                                # Try to handle epoch seconds/millis
                                if isinstance(ts, (int, float)):
                                    # Heuristic: treat > 10^12 as ms
                                    if ts > 10**12:
                                        utc_dt2 = datetime.utcfromtimestamp(ts / 1000.0).replace(tzinfo=ZoneInfo("UTC"))
                                    else:
                                        utc_dt2 = datetime.utcfromtimestamp(ts).replace(tzinfo=ZoneInfo("UTC"))
                                    ts_iso = utc_dt2.astimezone(ZoneInfo("Asia/Jerusalem")).isoformat()
                                else:
                                    ts_iso = None
                            except Exception:
                                ts_iso = None

                item = {
                    "id": str(doc.get("_id")),
                    "user": user_value,
                    "action": action_value,
                    "timestamp": ts_iso,
                }

                # Include raw details so the UI can display any extra info from Mongo
                if details:
                    item["details"] = details

                ip_value = details.get("ip") if isinstance(details, dict) else None
                if ip_value:
                    item["ip"] = ip_value

                logs.append(item)
            except Exception as map_exc:
                print(f"[audit] skipping malformed log doc: {map_exc}")
                continue
        return logs
    except Exception as exc:
        print(f"[audit] fetch failed: {exc}")
        return []

 