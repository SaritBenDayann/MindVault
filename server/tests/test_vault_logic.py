import pytest
import uuid
import bcrypt
from unittest.mock import patch
from app import create_app

@pytest.fixture
def auth_client():
    app = create_app()
    app.config["TESTING"] = True
    client = app.test_client()
    email = f"vault_test_{uuid.uuid4().hex[:6]}@test.com"
    password = "secure_password"
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    client.post('/auth/register', json={"email": email, "password": hashed, "salt": "s"})
    res = client.post('/auth/login', json={"email": email, "password": password})
    return client, {"Authorization": f"Bearer {res.get_json()['token']}"}, email

def test_save_encrypted_payload_integrity(auth_client):
    # Ensure the encrypted string is saved and returned exactly as sent
    client, headers, _ = auth_client
    secret = "ENC_BASE64_DATA_123!@#"
    payload = {"site": "test.com", "username": "user1", "password": secret}
    client.post('/vault/save', json=payload, headers=headers)
    
    res = client.post('/vault/reveal-password', json={"site": "test.com", "username": "user1"}, headers=headers)
    assert res.get_json()["password"] == secret

def test_update_encrypted_payload(auth_client):
    # Test updating an existing encrypted password
    client, headers, _ = auth_client
    client.post('/vault/save', json={"site": "a.com", "username": "u", "password": "p1"}, headers=headers)
    
    new_p = "NEW_ENC_DATA_456"
    res = client.put('/vault/update', json={"site": "a.com", "username": "u", "password": new_p}, headers=headers)
    assert res.status_code == 200
    
    reveal = client.post('/vault/reveal-password', json={"site": "a.com", "username": "u"}, headers=headers)
    assert reveal.get_json()["password"] == new_p

def test_long_encrypted_blob(auth_client):
    # Stress test: handle very large encrypted blobs (e.g., SSH keys)
    client, headers, _ = auth_client
    large_data = "A" * 10000
    res = client.post('/vault/save', json={"site": "x.com", "username": "u", "password": large_data}, headers=headers)
    assert res.status_code == 201


@patch('services.vault_service.get_site_description')
def test_ai_tagging_assignment(mock_desc, auth_client):
    # Mocking Wikipedia/ConceptNet to test if tag is assigned
    mock_desc.return_value = "Social media and networking service"
    client, headers, _ = auth_client
    res = client.post('/vault/save', json={"site": "facebook.com", "username": "u", "password": "p"}, headers=headers)
    assert "tag" in res.get_json()

def test_fallback_tagging_on_unknown_site(auth_client):
    # Test behavior when AI cannot find site description
    client, headers, _ = auth_client
    res = client.post('/vault/save', json={"site": "random-non-existent-123.io", "username": "u", "password": "p"}, headers=headers)
    assert res.get_json()["tag"] == "other"


def test_search_with_no_vault_items(auth_client):
    # Search when vault is empty
    client, headers, _ = auth_client
    res = client.get('/vault/search?q=google', headers=headers)
    assert res.get_json()["results"] == []

def test_search_relevance_ranking(auth_client):
    # Test TF-IDF ranking logic
    client, headers, _ = auth_client
    client.post('/vault/save', json={"site": "gmail.com", "username": "sarit", "password": "p"}, headers=headers)
    client.post('/vault/save', json={"site": "github.com", "username": "sarit", "password": "p"}, headers=headers)
    
    res = client.get('/vault/search?q=github', headers=headers)
    assert res.get_json()["results"][0]["site"] == "github.com"

def test_reveal_non_existent_item(auth_client):
    client, headers, _ = auth_client
    res = client.post('/vault/reveal-password', json={"site": "ghost.com", "username": "u"}, headers=headers)
    assert res.status_code == 404


def test_reveal_other_user_password(auth_client):
    # User A setup (from fixture)
    client, headers_a, email_a = auth_client
    client.post('/vault/save', json={"site": "target.com", "username": "admin", "password": "SECRET_A"}, headers=headers_a)

    # Setup User B (Hacker) with a bcrypt hash
    hacker_email = f"hacker_{uuid.uuid4().hex[:6]}@test.com"
    raw_password = "p"
    hashed_password = bcrypt.hashpw(raw_password.encode(), bcrypt.gensalt()).decode()
    
    client.post('/auth/register', json={"email": hacker_email, "password": hashed_password, "salt": "s"})
    res_b = client.post('/auth/login', json={"email": hacker_email, "password": raw_password})
    headers_b = {"Authorization": f"Bearer {res_b.get_json()['token']}"}
    
    # User B tries to reveal User A's password
    res = client.post('/vault/reveal-password', json={"site": "target.com", "username": "admin"}, headers=headers_b)
    assert res.status_code == 404 

def test_delete_other_user_entry(auth_client):
    # User A setup
    client, headers_a, _ = auth_client
    client.post('/vault/save', json={"site": "del.com", "username": "u", "password": "p"}, headers=headers_a)

    # User B setup with a bcrypt hash
    user_b_email = f"user_b_{uuid.uuid4().hex[:6]}@test.com"
    raw_password = "p"
    hashed_password = bcrypt.hashpw(raw_password.encode(), bcrypt.gensalt()).decode()
    
    client.post('/auth/register', json={"email": user_b_email, "password": hashed_password, "salt": "s"})
    login_b = client.post('/auth/login', json={"email": user_b_email, "password": raw_password})
    tk_b = login_b.get_json()["token"]
    
    # User B tries to delete A's entry
    res = client.delete('/vault/del.com/u', headers={"Authorization": f"Bearer {tk_b}"})
    assert res.status_code == 404

def test_save_missing_password_field(auth_client):
    client, headers, _ = auth_client
    res = client.post('/vault/save', json={"site": "s.com", "username": "u"}, headers=headers)
    assert res.status_code == 400

def test_save_empty_strings(auth_client):
    client, headers, _ = auth_client
    res = client.post('/vault/save', json={"site": "", "username": "", "password": ""}, headers=headers)
    assert res.status_code == 400

def test_update_missing_site(auth_client):
    client, headers, _ = auth_client
    res = client.put('/vault/update', json={"username": "u", "password": "p"}, headers=headers)
    assert res.status_code == 400

def test_search_special_characters_handling(auth_client):
    # Ensure TF-IDF vectorizer doesn't crash on regex characters
    client, headers, _ = auth_client
    res = client.get('/vault/search?q=.*+?^${}()|[]\\', headers=headers)
    assert res.status_code == 200

def test_delete_non_existent_item(auth_client):
    client, headers, _ = auth_client
    res = client.delete('/vault/non-existent/user', headers=headers)
    assert res.status_code == 404