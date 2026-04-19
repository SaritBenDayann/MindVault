import pytest
import uuid
import bcrypt
from app import create_app

# --- Setup Fixture ---
@pytest.fixture
def auth_client():
    app = create_app()
    app.config["TESTING"] = True
    client = app.test_client()
    
    email = f"user_{uuid.uuid4().hex[:8]}@test.com"
    password = "test_password"
    hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    client.post('/auth/register', json={"email": email, "password": hashed_pw, "salt": "salt"})
    res = client.post('/auth/login', json={"email": email, "password": password})
    token = res.get_json().get("token")
    
    headers = {"Authorization": f"Bearer {token}"}
    return client, headers, email

# --- Helper data ---
# Updated to match your route's expected keys (site, username, password)
SAMPLE_VAULT_ITEM = {
    "site": "github.com",
    "username": "test_user",
    "password": "encrypted_data_string"
}

# ==========================================
# Group 1: CRUD Operations matched to your Routes
# ==========================================

def test_create_vault_entry(auth_client):
    client, headers, _ = auth_client
    response = client.post('/vault/save', json=SAMPLE_VAULT_ITEM, headers=headers)
    assert response.status_code in [200, 201]

def test_get_vault_entries(auth_client):
    client, headers, _ = auth_client
    client.post('/vault/save', json=SAMPLE_VAULT_ITEM, headers=headers)
    
    response = client.get('/vault/vaults', headers=headers)
    assert response.status_code == 200

def test_update_vault_entry(auth_client):
    client, headers, _ = auth_client
    client.post('/vault/save', json=SAMPLE_VAULT_ITEM, headers=headers)
    
    updated_data = {"site": "github.com", "username": "test_user", "password": "new_encrypted_data"}
    response = client.put('/vault/update', json=updated_data, headers=headers)
    assert response.status_code == 200

def test_delete_vault_entry(auth_client):
    client, headers, _ = auth_client
    client.post('/vault/save', json=SAMPLE_VAULT_ITEM, headers=headers)
    
    site = SAMPLE_VAULT_ITEM["site"]
    username = SAMPLE_VAULT_ITEM["username"]
    response = client.delete(f'/vault/{site}/{username}', headers=headers)
    assert response.status_code == 200

# ==========================================
# Group 2: Advanced Features & Isolation
# ==========================================

def test_vault_search(auth_client):
    client, headers, _ = auth_client
    client.post('/vault/save', json=SAMPLE_VAULT_ITEM, headers=headers)
    
    response = client.get('/vault/search?q=github', headers=headers)
    assert response.status_code == 200
    data = response.get_json()
    assert "results" in data

def test_data_isolation_between_users(auth_client):
    client, headers_a, _ = auth_client
    client.post('/vault/save', json=SAMPLE_VAULT_ITEM, headers=headers_a)
    
    # User B setup
    email_b = f"user_b_{uuid.uuid4().hex[:8]}@test.com"
    hashed_pw = bcrypt.hashpw("pw".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    client.post('/auth/register', json={"email": email_b, "password": hashed_pw, "salt": "salt"})
    res_b = client.post('/auth/login', json={"email": email_b, "password": "pw"})
    headers_b = {"Authorization": f"Bearer {res_b.get_json()['token']}"}
    
    # User B fetches their vaults - should not see User A's data
    response = client.get('/vault/vaults', headers=headers_b)
    assert response.status_code == 200
    
    data = response.get_json()
    # Check if empty (handles both list returns and dict like {"vaults": []})
    if isinstance(data, list):
        assert len(data) == 0
    elif isinstance(data, dict):
        assert len(data.get("vaults", data.get("results", []))) == 0

def test_unauthorized_deletion_attempt(auth_client):
    client, headers_a, _ = auth_client
    client.post('/vault/save', json=SAMPLE_VAULT_ITEM, headers=headers_a)
    
    # User B setup
    email_b = f"hacker_{uuid.uuid4().hex[:8]}@test.com"
    hashed_pw = bcrypt.hashpw("pw".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    client.post('/auth/register', json={"email": email_b, "password": hashed_pw, "salt": "salt"})
    res_b = client.post('/auth/login', json={"email": email_b, "password": "pw"})
    headers_b = {"Authorization": f"Bearer {res_b.get_json()['token']}"}
    
    site = SAMPLE_VAULT_ITEM["site"]
    username = SAMPLE_VAULT_ITEM["username"]
    response = client.delete(f'/vault/{site}/{username}', headers=headers_b)
    
    assert response.status_code in [403, 404]

# ==========================================
# Group 3: Edge Cases & Validation
# ==========================================

def test_missing_required_fields_on_insert(auth_client):
    client, headers, _ = auth_client
    bad_item = {"site": "github.com"} # Missing username and password
    response = client.post('/vault/save', json=bad_item, headers=headers)
    assert response.status_code in [400, 422, 500]

def test_update_non_existent_item(auth_client):
    client, headers, _ = auth_client
    fake_item = {"site": "doesnotexist.com", "username": "ghost", "password": "123"}
    response = client.put('/vault/update', json=fake_item, headers=headers)
    assert response.status_code in [404, 400]

def test_xss_in_vault_data(auth_client):
    client, headers, _ = auth_client
    xss_item = {
        "site": "<script>alert(1)</script>",
        "username": "admin",
        "password": "123"
    }
    response = client.post('/vault/save', json=xss_item, headers=headers)
    # The DB/API should accept it safely without crashing
    assert response.status_code in [200, 201]


    # ==========================================
# Group 4: Extreme Edge Cases & Advanced DB Logic
# ==========================================

def test_reveal_non_existent_entry(auth_client):
    client, headers, _ = auth_client
    # Ask the DB to reveal a password for a site that was never saved
    payload = {"site": "never-saved.com", "username": "ghost"}
    response = client.post('/vault/reveal-password', json=payload, headers=headers)
    assert response.status_code == 404

def test_unauthorized_reveal_attempt(auth_client):
    client, headers_a, _ = auth_client
    # User A saves an item
    client.post('/vault/save', json=SAMPLE_VAULT_ITEM, headers=headers_a)
    
    # User B setup
    email_b = f"snooper_{uuid.uuid4().hex[:8]}@test.com"
    hashed_pw = bcrypt.hashpw("pw".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    client.post('/auth/register', json={"email": email_b, "password": hashed_pw, "salt": "salt"})
    res_b = client.post('/auth/login', json={"email": email_b, "password": "pw"})
    headers_b = {"Authorization": f"Bearer {res_b.get_json()['token']}"}
    
    # User B tries to reveal User A's password
    payload = {"site": SAMPLE_VAULT_ITEM["site"], "username": SAMPLE_VAULT_ITEM["username"]}
    response = client.post('/vault/reveal-password', json=payload, headers=headers_b)
    # Must be blocked - either not found or forbidden
    assert response.status_code in [403, 404]

def test_delete_already_deleted_entry(auth_client):
    client, headers, _ = auth_client
    client.post('/vault/save', json=SAMPLE_VAULT_ITEM, headers=headers)
    
    site = SAMPLE_VAULT_ITEM["site"]
    username = SAMPLE_VAULT_ITEM["username"]
    
    # Delete it once (should succeed)
    client.delete(f'/vault/{site}/{username}', headers=headers)
    
    # Delete it again (Idempotency test)
    response = client.delete(f'/vault/{site}/{username}', headers=headers)
    assert response.status_code in [200, 404] # Both are acceptable in REST, as long as it doesn't crash

def test_empty_string_values_in_db(auth_client):
    client, headers, _ = auth_client
    # Sending empty strings instead of missing fields
    empty_item = {"site": "", "username": "", "password": ""}
    response = client.post('/vault/save', json=empty_item, headers=headers)
    # Validation should catch this, DB shouldn't save empty critical fields
    assert response.status_code in [400, 422]

def test_search_nosql_injection_payload(auth_client):
    client, headers, _ = auth_client
    # Attempt to bypass search logic by sending a MongoDB operator instead of a string
    response = client.get('/vault/search?q={"$ne": null}', headers=headers)
    # The server should sanitize or reject this gracefully
    assert response.status_code != 500

def test_unicode_and_emojis_in_db(auth_client):
    client, headers, _ = auth_client
    # Test how MongoDB handles complex UTF-8 characters
    complex_item = {
        "site": "מערכת_בעברית.ישראל",
        "username": "משתמש_123 🕵️‍♂️",
        "password": "🔐סודיביותר"
    }
    response = client.post('/vault/save', json=complex_item, headers=headers)
    # MongoDB handles UTF-8 natively, so this should work or be validated, not crash
    assert response.status_code in [200, 201]


def test_search_special_regex_characters(auth_client):
    client, headers, _ = auth_client
    # If the search endpoint uses regex under the hood, special characters might break it
    client.post('/vault/save', json=SAMPLE_VAULT_ITEM, headers=headers)
    
    # Send characters that break unescaped regex patterns
    response = client.get('/vault/search?q=.*+?^${}()|[]\\', headers=headers)
    # Should safely return an empty list or 400, not crash the regex engine
    assert response.status_code == 200
    data = response.get_json()
    assert len(data.get("results", [])) == 0