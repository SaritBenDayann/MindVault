from flask import Blueprint, request, jsonify
from services.jwt_service import token_required
from services.llm_service import llm_service
from services.vault_service import get_user_vaults 

llm_bp = Blueprint('llm', __name__, url_prefix='/api/ai')

@llm_bp.route('/generate-password', methods=['POST'])
@token_required
def generate_password(current_user):
    mindvault_email = current_user['email']
    
    data = request.get_json()
    if not data or 'prompt' not in data:
        return jsonify({'error': 'Missing prompt in request'}), 400
    
    user_prompt = data['prompt']
    site = data.get('site', '')
    username = data.get('username', '')
    history = data.get('history', []) 
    
    saved_sites = []
    try:
        vaults = get_user_vaults(mindvault_email) 
        saved_sites = [vault.get('site', '') for vault in vaults if vault.get('site')]
    except Exception as e:
        print(f"Could not fetch vaults for AI context: {e}")

    ai_response = llm_service.generate_password_suggestion(
        user_prompt, 
        site, 
        username, 
        history, 
        saved_sites,
        mindvault_email
    )
    
    return jsonify({'response': ai_response}), 200