import pytest
from unittest.mock import patch, MagicMock
from services.llm_service import LLMService
from app import create_app

@pytest.fixture
def app():
    app = create_app()
    app.config.update({"TESTING": True})
    return app

@pytest.fixture
def llm_instance():
    # Create a fresh instance for service-level tests
    with patch('google.genai.Client'):
        return LLMService()

# ==========================================
# Group 1: Service Logic Tests
# ==========================================

def test_llm_tag_wrapping_format(llm_instance):
    # Mock the internal client's chat response
    mock_chat = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "Here is your password: [PASSWORD]Safe123![/PASSWORD]"
    mock_chat.send_message.return_value = mock_response
    
    with patch.object(llm_instance.client.chats, 'create', return_value=mock_chat):
        response = llm_instance.generate_password_suggestion("test", "site.com", "user", [], [], "a@b.com")
        assert "[PASSWORD]" in response
        assert "Safe123!" in response

def test_history_auto_correction_model_first(llm_instance):
    history = [{'role': 'model', 'text': 'I am AI'}]
    mock_chat = MagicMock()
    mock_chat.send_message.return_value = MagicMock(text="OK")
    
    with patch.object(llm_instance.client.chats, 'create', return_value=mock_chat) as mock_create:
        llm_instance.generate_password_suggestion("p", "s", "u", history, [], "e")
        # Check that the first message sent to Google was 'user' (auto-corrected)
        sent_history = mock_create.call_args[1]['history']
        assert sent_history[0].role == "user"

# ==========================================
# Group 2: Route & Controller Tests
# ==========================================

@patch('services.llm_service.llm_service.generate_password_suggestion')
@patch('services.jwt_service.validate_jwt_token')
def test_route_generate_password_success(mock_jwt, mock_llm, client):
    mock_jwt.return_value = {"email": "test@test.com"}
    mock_llm.return_value = "[PASSWORD]Sample!123[/PASSWORD]"
    
    headers = {"Authorization": "Bearer valid"}
    payload = {"prompt": "Give me a password"}
    
    response = client.post('/api/ai/generate-password', json=payload, headers=headers)
    assert response.status_code == 200
    assert "Sample!123" in response.get_json()['response']

# ==========================================
# Group 3: Error Handling
# ==========================================

def test_llm_rate_limit_handling(llm_instance):
    mock_chat = MagicMock()
    mock_chat.send_message.side_effect = Exception("429 RESOURCE_EXHAUSTED")
    
    with patch.object(llm_instance.client.chats, 'create', return_value=mock_chat):
        response = llm_instance.generate_password_suggestion("p", "s", "u", [], [], "e")
        assert "too many requests" in response

def test_llm_general_api_error(llm_instance):
    with patch.object(llm_instance.client.chats, 'create', side_effect=Exception("Internal Server Error")):
        response = llm_instance.generate_password_suggestion("p", "s", "u", [], [], "e")
        assert "error communicating with the AI" in response

# ==========================================
# Group 4: Context & Edge Cases
# ==========================================

def test_llm_unicode_prompt(llm_instance):
    mock_chat = MagicMock()
    mock_chat.send_message.return_value = MagicMock(text="OK")
    
    with patch.object(llm_instance.client.chats, 'create', return_value=mock_chat):
        response = llm_instance.generate_password_suggestion("תכתוב לי סיסמה", "s", "u", [], [], "e")
        assert response == "OK"