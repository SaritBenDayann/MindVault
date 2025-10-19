import jwt
from flask import current_app, request, jsonify
from functools import wraps
from datetime import datetime, timedelta


def generate_jwt_token(email: str) -> str:
    payload = {
        "email": email,
        "exp": datetime.utcnow() + current_app.config["JWT_EXPIRATION_DELTA"]
    }
    return jwt.encode(
        payload,
        current_app.config["JWT_SECRET_KEY"],
        algorithm=current_app.config["JWT_ALGORITHM"]
    )


def validate_jwt_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            current_app.config["JWT_SECRET_KEY"],
            algorithms=[current_app.config["JWT_ALGORITHM"]]
        )
        return {"email": payload["email"]}
    except jwt.ExpiredSignatureError:
        return {"error": "Token expired"}
    except jwt.InvalidTokenError:
        return {"error": "Invalid token"}


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authorization header missing or malformed"}), 401

        token = auth_header.split(" ", 1)[1].strip()
        validation = validate_jwt_token(token)
        if "error" in validation:
            return jsonify({"error": validation["error"]}), 401

        current_user = {"email": validation["email"]}
        return f(current_user, *args, **kwargs)

    return decorated
