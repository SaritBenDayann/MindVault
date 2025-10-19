from flask import Blueprint, request, jsonify
from services.jwt_service import token_required
from services.breach_service import breach_service
from services.audit_service import log_audit_event
from datetime import datetime

breach_bp = Blueprint('breach', __name__)




@breach_bp.route('/check-password', methods=['POST'])
@token_required
def check_password_breach(current_user):
    """Check if a password has been compromised using HIBP's free API"""
    try:
        data = request.get_json()
        password = data.get('password')
        site = data.get('site', 'manual_check')
        username = data.get('username', 'manual_check')
        
        if not password:
            return jsonify({"error": "Password is required"}), 400
        
        result = breach_service.check_password_breach(password)
        
        if "error" in result:
            return jsonify(result), 500
        
        is_manual_check = (site == 'manual_check' and username == 'manual_check')
        
        if not is_manual_check:
            breach_data = {
                "site": site,
                "username": username,
                "is_breached": result.get("is_breached", False),
                "breach_count": result.get("breach_count", 0),
                "message": result.get("message", ""),
                "checked_at": datetime.utcnow().isoformat()
            }
            
            store_result, store_status = breach_service.store_password_breach_data(
                current_user['email'], 
                site, 
                username, 
                breach_data
            )
            
            if store_status != 200:
                print(f"Warning: Failed to store breach data: {store_result}")
        
        log_audit_event(current_user['email'], "password_breach_check_completed")
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500


@breach_bp.route('/password-breach-data', methods=['GET'])
@token_required
def get_password_breach_data(current_user):
    """Get all password breach data for the current user"""
    try:
        result, status = breach_service.get_user_password_breach_data(current_user['email'])
        return jsonify(result), status
        
    except Exception as e:
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500


@breach_bp.route('/check-vault-passwords', methods=['POST'])
@token_required
def check_vault_passwords(current_user):
    """Check all vault passwords for breaches and store results"""
    try:
        data = request.get_json()
        vault_entries = data.get('vault_entries', [])
        
        if not vault_entries:
            return jsonify({"error": "No vault entries provided"}), 400
        
        results = []
        errors = []
        
        for entry in vault_entries:
            try:
                site = entry.get('site', '')
                username = entry.get('username', '')
                password = entry.get('password', '')
                
                if not password:
                    errors.append(f"No password provided for {site}:{username}")
                    continue
                
                breach_result = breach_service.check_password_breach(password)
                
                if "error" in breach_result:
                    errors.append(f"Failed to check {site}:{username}: {breach_result['error']}")
                    continue
                
                breach_data = {
                    "site": site,
                    "username": username,
                    "is_breached": breach_result.get("is_breached", False),
                    "breach_count": breach_result.get("breach_count", 0),
                    "message": breach_result.get("message", ""),
                    "checked_at": datetime.utcnow().isoformat()
                }
                
                store_result, store_status = breach_service.store_password_breach_data(
                    current_user['email'], 
                    site, 
                    username, 
                    breach_data
                )
                
                results.append({
                    "site": site,
                    "username": username,
                    "is_breached": breach_result.get("is_breached", False),
                    "breach_count": breach_result.get("breach_count", 0),
                    "message": breach_result.get("message", ""),
                    "stored": store_status == 200
                })
                
            except Exception as e:
                errors.append(f"Error checking {entry.get('site', 'unknown')}: {str(e)}")
        
        log_audit_event(current_user['email'], f"vault_breach_check_completed:{len(results)}_checked")
        
        return jsonify({
            "results": results,
            "errors": errors,
            "totalChecked": len(vault_entries),
            "successfulChecks": len(results)
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

