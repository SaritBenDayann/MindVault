import os
import sys
import pytest
import jwt
from datetime import timedelta
from flask import jsonify
from app import create_app

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from services.jwt_service import generate_jwt_token, validate_jwt_token, token_required

@pytest.fixture
def app():
    app = create_app()
    app.config.update({
        "TESTING": True,
        "JWT_SECRET_KEY": "test_secret",
        "JWT_ALGORITHM": "HS256",
        "JWT_EXPIRATION_DELTA": timedelta(hours=1)
    })
    return app

# ==========================================
# Group 1: Token Generation & Encoding
# ==========================================

def test_generate_token_success(app):
    with app.app_context():
        token = generate_jwt_token("test@user.com")
        assert isinstance(token, str)
        assert len(token.split('.')) == 3

def test_token_payload_contains_email(app):
    with app.app_context():
        token = generate_jwt_token("sarit@huji.ac.il")
        decoded = jwt.decode(token, app.config["JWT_SECRET_KEY"], algorithms=[app.config["JWT_ALGORITHM"]])
        assert decoded["email"] == "sarit@huji.ac.il"

def test_token_expiration_logic(app):
    with app.app_context():
        token = generate_jwt_token("test@user.com")
        decoded = jwt.decode(token, options={"verify_signature": False})
        assert "exp" in decoded

# ==========================================
# Group 2: Token Validation & Decoding
# ==========================================

def test_validate_valid_token(app):
    with app.app_context():
        token = generate_jwt_token("valid@test.com")
        result = validate_jwt_token(token)
        assert result["email"] == "valid@test.com"

def test_validate_expired_token(app):
    with app.app_context():
        # Force expiration by setting delta to negative
        app.config["JWT_EXPIRATION_DELTA"] = timedelta(seconds=-1)
        token = generate_jwt_token("old@test.com")
        result = validate_jwt_token(token)
        assert result["error"] == "Token expired"

def test_validate_invalid_string(app):
    with app.app_context():
        result = validate_jwt_token("this.is.notatoken")
        assert result["error"] == "Invalid token"

def test_validate_wrong_secret(app):
    with app.app_context():
        payload = {"email": "a@b.com"}
        fake_token = jwt.encode(payload, "WRONG_SECRET", algorithm="HS256")
        result = validate_jwt_token(fake_token)
        assert result["error"] == "Invalid token"

def test_validate_modified_payload(app):
    with app.app_context():
        token = generate_jwt_token("user@test.com")
        parts = token.split('.')
        parts[1] = "eyJlbWFpbCI6ImhhY2tlckB0ZXN0LmNvbSJ9" 
        tampered_token = ".".join(parts)
        result = validate_jwt_token(tampered_token)
        assert result["error"] == "Invalid token"

# ==========================================
# Group 3: @token_required Decorator Tests
# ==========================================

def test_decorator_success(app, client):
    @app.route('/test_protected')
    @token_required
    def protected(current_user):
        return jsonify(current_user), 200

    with app.app_context():
        token = generate_jwt_token("sarit@test.com")
    
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get('/test_protected', headers=headers)
    assert response.status_code == 200
    assert response.get_json()["email"] == "sarit@test.com"

def test_decorator_missing_header(app, client):
    @app.route('/test_no_header')
    @token_required
    def protected(current_user): return "ok"

    response = client.get('/test_no_header')
    assert response.status_code == 401

def test_decorator_wrong_prefix(app, client):
    @app.route('/test_no_bearer')
    @token_required
    def protected(current_user): return "ok"

    headers = {"Authorization": "Basic 12345"}
    response = client.get('/test_no_bearer', headers=headers)
    assert response.status_code == 401

def test_decorator_expired_token_block(app, client):
    @app.route('/test_expired')
    @token_required
    def protected(current_user): return "ok"

    with app.app_context():
        app.config["JWT_EXPIRATION_DELTA"] = timedelta(seconds=-1)
        token = generate_jwt_token("expired@test.com")
    
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get('/test_expired', headers=headers)
    assert response.status_code == 401

# ==========================================
# Group 4: Edge Cases & Hardening
# ==========================================

def test_generate_token_non_ascii_email(app):
    with app.app_context():
        token = generate_jwt_token("שרית@test.com")
        result = validate_jwt_token(token)
        assert result["email"] == "שרית@test.com"

def test_validate_empty_token(app):
    with app.app_context():
        assert validate_jwt_token("")["error"] == "Invalid token"

def test_token_with_extra_segments(app):
    with app.app_context():
        token = generate_jwt_token("a@b.com") + ".extra.part"
        assert validate_jwt_token(token)["error"] == "Invalid token"

def test_decorator_passes_user_dict(app, client):
    @app.route('/test_user_injection')
    @token_required
    def protected(current_user):
        return jsonify({"is_dict": isinstance(current_user, dict)}), 200

    with app.app_context():
        token = generate_jwt_token("user@test.com")
    
    res = client.get('/test_user_injection', headers={"Authorization": f"Bearer {token}"})
    assert res.get_json()["is_dict"] is True

def test_algorithm_enforcement(app):
    with app.app_context():
        token = generate_jwt_token("a@b.com")
        with pytest.raises(jwt.InvalidAlgorithmError):
            jwt.decode(token, app.config["JWT_SECRET_KEY"], algorithms=["none"])

def test_large_payload_token(app):
    long_email = "a" * 500 + "@test.com"
    with app.app_context():
        token = generate_jwt_token(long_email)
        assert validate_jwt_token(token)["email"] == long_email

def test_decorator_malformed_bearer(app, client):
    @app.route('/test_malformed')
    @token_required
    def protected(current_user): return "ok"

    response = client.get('/test_malformed', headers={"Authorization": "Bearer "})
    assert response.status_code == 401

def test_jwt_configuration_integrity(app):
    with app.app_context():
        assert "JWT_SECRET_KEY" in app.config
        assert "JWT_ALGORITHM" in app.config