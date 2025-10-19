from flask import current_app
from .jwt_service import generate_jwt_token, validate_jwt_token
import bcrypt


def register_user(email, password, salt):
    db = current_app.db
    if db.users.find_one({"email": email}):
        return {"error": "User already exists"}, 400

    db.users.insert_one({
        "email": email,
        "password": password,
        "salt": salt
    })
    return {"message": "User registered successfully"}, 201


def login_user(email, password):
    db = current_app.db
    user = db.users.find_one({"email": email})
    if not user:
        return {"error": "User not found"}, 404
    stored_hash = user["password"]

    if not bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8')):
        return {"error": "Incorrect password"}, 401

    token = generate_jwt_token(email)
    return {"token": token}, 200


def decode_token(auth_header):
    if not auth_header or not auth_header.startswith("Bearer "):
        return None, {"error": "Missing or invalid token"}, 401

    token = auth_header.split(" ")[1]
    result = validate_jwt_token(token)
    
    if "error" in result:
        return None, result, 401
    
    return result["email"], None, None
