from flask import Blueprint, jsonify, request
from services.audit_service import get_recent_audit_logs
from services.jwt_service import validate_jwt_token

audit_bp = Blueprint("audit", __name__)

@audit_bp.route("/audit-logs", methods=["GET"])
def get_audit_logs_route():
    logs = get_recent_audit_logs()
    return jsonify(logs), 200

@audit_bp.route("/audit/logs/recent", methods=["GET"])
def get_logs():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_data = validate_jwt_token(token)
    
    if "error" in user_data:
        return jsonify(user_data), 401
    
    current_user_email = user_data["email"]
    
    days = request.args.get('days', 7, type=float)
    
    if days <= 0:
        days = 36500
    else:
        print(f"Using {days} days for filtering")
    
    logs = get_recent_audit_logs(user=current_user_email, days=days)
    return jsonify(logs), 200