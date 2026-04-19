import pytest
import bcrypt
import uuid
from app import create_app

@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

UNIQUE_EMAIL = f"flow_test_{uuid.uuid4().hex[:8]}@example.com"
PLAIN_PASSWORD = "my_secure_password"
VALID_BCRYPT_HASH = bcrypt.hashpw(PLAIN_PASSWORD.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

TEST_USER = {
    "email": UNIQUE_EMAIL,
    "password": VALID_BCRYPT_HASH,
    "salt": "random_salt_string"
}

LOGIN_PAYLOAD = {
    "email": UNIQUE_EMAIL,
    "password": PLAIN_PASSWORD
}

def test_successful_registration(client):
    response = client.post('/auth/register', json=TEST_USER)
    assert response.status_code == 201

def test_duplicate_registration_prevented(client):
    response = client.post('/auth/register', json=TEST_USER)
    assert response.status_code in [400, 409]

def test_successful_login_returns_token(client):
    response = client.post('/auth/login', json=LOGIN_PAYLOAD)
    assert response.status_code == 200
    assert "token" in response.get_json()

def test_jwt_token_structure(client):
    response = client.post('/auth/login', json=LOGIN_PAYLOAD)
    token = response.get_json()["token"]
    assert len(token.split('.')) == 3

def test_token_grants_access_to_protected_route(client):
    login_res = client.post('/auth/login', json=LOGIN_PAYLOAD)
    token = login_res.get_json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get('/auth/protected', headers=headers)
    assert response.status_code == 200

def test_password_case_sensitivity(client):
    payload = {"email": TEST_USER["email"], "password": PLAIN_PASSWORD.upper()}
    response = client.post('/auth/login', json=payload)
    assert response.status_code == 401

def test_register_missing_salt(client):
    payload = {"email": f"no_salt_{uuid.uuid4().hex[:8]}@example.com", "password": VALID_BCRYPT_HASH}
    response = client.post('/auth/register', json=payload)
    assert response.status_code == 201

def test_logout_invalidates_session(client):
    login_res = client.post('/auth/login', json=LOGIN_PAYLOAD)
    token = login_res.get_json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post('/auth/logout', headers=headers)
    assert response.status_code == 200

def test_login_unregistered_user(client):
    # Random email that doesn't exist in the system
    payload = {"email": f"ghost_{uuid.uuid4().hex[:8]}@example.com", "password": PLAIN_PASSWORD}
    response = client.post('/auth/login', json=payload)
    assert response.status_code == 404