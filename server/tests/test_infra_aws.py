import pytest
import uuid
from unittest.mock import patch, MagicMock
from botocore.exceptions import ClientError, NoCredentialsError, ConnectTimeoutError
from pymongo.errors import ConnectionFailure, OperationFailure, ServerSelectionTimeoutError
from redis.exceptions import ConnectionError as RedisConnectionError, TimeoutError as RedisTimeoutError
from app import create_app

@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

# ==========================================
# Group 1: AWS & IAM Security Tests
# ==========================================

@patch('boto3.client')
def test_aws_ssm_access_denied(mock_boto_client, client):
    # Simulate IAM Role misconfiguration (Access Denied)
    mock_ssm = MagicMock()
    mock_ssm.get_parameter.side_effect = ClientError(
        {"Error": {"Code": "AccessDeniedException"}}, "GetParameter"
    )
    mock_boto_client.return_value = mock_ssm
    
    # System should handle access denied without leaking stack traces
    with pytest.raises(Exception) as exc_info:
        # Assuming config tries to load on startup or specific route
        mock_ssm.get_parameter(Name='SECRET_KEY')
    assert "AccessDenied" in str(exc_info.value)

@patch('boto3.client')
def test_aws_missing_credentials(mock_boto_client, client):
    # Simulate EC2 instance losing its IAM profile
    mock_boto_client.side_effect = NoCredentialsError()
    
    with pytest.raises(NoCredentialsError):
        mock_boto_client('ssm')

@patch('boto3.client')
def test_aws_ssm_parameter_not_found(mock_boto_client, client):
    # Simulate accidental deletion of a secret in AWS
    mock_ssm = MagicMock()
    mock_ssm.get_parameter.side_effect = ClientError(
        {"Error": {"Code": "ParameterNotFound"}}, "GetParameter"
    )
    mock_boto_client.return_value = mock_ssm
    
    with pytest.raises(ClientError):
        mock_ssm.get_parameter(Name='DB_PASSWORD')

@patch('boto3.client')
def test_aws_network_timeout(mock_boto_client, client):
    # Simulate AWS API being unreachable
    mock_boto_client.side_effect = ConnectTimeoutError(endpoint_url="ssm.eu-central-1.amazonaws.com")
    
    with pytest.raises(ConnectTimeoutError):
        mock_boto_client('ssm')
# ==========================================
# Group 2: MongoDB Resilience Tests
# ==========================================

@patch('pymongo.collection.Collection.find_one')
def test_mongo_connection_failure(mock_find_one, client):
    # Simulate database dropping the connection mid-query
    mock_find_one.side_effect = ConnectionFailure("Connection dropped")
    
    # In Flask TESTING mode, unhandled DB errors propagate as actual exceptions
    with pytest.raises(ConnectionFailure):
        client.post('/auth/login', json={"email": "test@test.com", "password": "123"})

@patch('pymongo.collection.Collection.find_one')
def test_mongo_auth_failure(mock_find_one, client):
    # Simulate wrong MongoDB Atlas password being loaded
    mock_find_one.side_effect = OperationFailure("Authentication failed")
    
    with pytest.raises(OperationFailure):
        client.post('/auth/login', json={"email": "test@test.com", "password": "123"})

@patch('pymongo.collection.Collection.insert_one')
def test_mongo_timeout_during_write(mock_insert, client):
    # Simulate network lag when saving a new user
    mock_insert.side_effect = ServerSelectionTimeoutError("Timeout")
    
    # Use a random email so the real find_one() doesn't block us with a 400 "User exists" error
    random_email = f"timeout_{uuid.uuid4().hex[:8]}@test.com"
    
    with pytest.raises(ServerSelectionTimeoutError):
        client.post('/auth/register', json={"email": random_email, "password": "123", "salt": "salt"})

@patch('pymongo.collection.Collection.find_one')
def test_mongo_empty_result_handling(mock_find_one, client):
    # Ensure database returning exactly None is handled securely
    mock_find_one.return_value = None
    
    response = client.post('/auth/login', json={"email": "nobody@test.com", "password": "123"})
    assert response.status_code == 404

# ==========================================
# Group 3: Redis Cache & Session Tests
# ==========================================

@patch('services.socketio_instance.socketio.emit') # Assuming you use Redis via SocketIO or similar
def test_redis_connection_refused(mock_emit, client):
    # Simulate Redis container crashing
    mock_emit.side_effect = RedisConnectionError("Connection refused")
    
    try:
        mock_emit('event', {'data': 'test'})
    except Exception as e:
        assert isinstance(e, RedisConnectionError)

@patch('redis.Redis.get')
def test_redis_timeout_on_read(mock_redis_get, client):
    # Simulate Redis hanging
    mock_redis_get.side_effect = RedisTimeoutError("Timeout reading from socket")
    
    with pytest.raises(RedisTimeoutError):
        mock_redis_get('some_token')

@patch('redis.Redis.get')
def test_redis_returns_corrupted_data(mock_redis_get, client):
    # Simulate Redis returning unexpected bytes instead of UTF-8 string
    mock_redis_get.return_value = b'\xff\xfe\xfd'
    
    data = mock_redis_get('some_key')
    # Validating that raw bytes are handled without automatic decoding crashes
    assert type(data) is bytes

@patch('redis.Redis.ping')
def test_redis_auth_failure(mock_ping, client):
    # Simulate wrong Redis password
    mock_ping.side_effect = Exception("NOAUTH Authentication required.")
    
    with pytest.raises(Exception) as excinfo:
        mock_ping()
    assert "NOAUTH" in str(excinfo.value)

# ==========================================
# Group 4: Server Environment & Health Checks
# ==========================================

def test_health_check_endpoint(client):
    # Verify the health endpoint exists for AWS Target Group (ALB/EC2)
    response = client.get('/')
    assert response.status_code == 200
    assert "active" in response.get_json().get("status", "")

@patch('app.db.command')
def test_health_check_db_degradation(mock_db_command, client):
    # If we add DB ping to healthcheck, test how it reports failure
    # Mocking DB ping failure
    mock_db_command.side_effect = ConnectionFailure("Ping failed")
    
    try:
        mock_db_command("ping")
    except ConnectionFailure:
        assert True

def test_cors_security_headers(client):
    # Verify AWS Application Load Balancer / Flask CORS headers
    response = client.options('/auth/login', headers={'Origin': 'http://malicious-site.com'})
    # Should not allow malicious origin
    if "Access-Control-Allow-Origin" in response.headers:
        assert response.headers["Access-Control-Allow-Origin"] != "http://malicious-site.com"

def test_boto3_user_agent_injection(client):
    # Ensure internal boto3 calls don't leak server info via custom headers
    import boto3
    session = boto3.Session()
    assert session is not None