from flask import Blueprint, request, jsonify, current_app
from services.auth_service import register_user, login_user
from services.jwt_service import validate_jwt_token
from services.audit_service import log_audit_event
from config import CRYPTO_STATIC_SALT, CRYPTO_ITERATIONS

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/register", methods=["POST"])
def register_route():
    data = request.get_json()
    email = data.get("email")
    password_hash = data.get("password")
    salt = data.get("salt")

    response, status = register_user(email, password_hash, salt)
    if status == 201:
        log_audit_event(email, "Registered")
    return jsonify(response), status


@auth_bp.route("/login", methods=["POST"])
def login_route():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    response, status = login_user(email, password)
    if status == 200:
        log_audit_event(email, "Logged in")
    return jsonify(response), status


@auth_bp.route("/protected", methods=["GET"])
def protected_route():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_data = validate_jwt_token(token)

    if "error" in user_data:
        return jsonify(user_data), 401

    return jsonify({
        "message": f"Hey, {user_data['email']}. This is a protected route."
    }), 200

@auth_bp.route("/logout", methods=["POST"])
def logout_route():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user = validate_jwt_token(token)
    
    if "error" not in user and "email" in user:
        log_audit_event(user["email"], "Logged out")
    else:
        error_type = user.get("error", "unknown")
        log_audit_event("unknown_user", f"Logged out (token {error_type})")
    
    return jsonify({"message": "Logged out"}), 200


@auth_bp.route("/crypto-config", methods=["GET"])
def crypto_config_route():
    """Serve crypto configuration to client"""
    return jsonify({
        "staticSalt": CRYPTO_STATIC_SALT,
        "iterations": CRYPTO_ITERATIONS
    }), 200