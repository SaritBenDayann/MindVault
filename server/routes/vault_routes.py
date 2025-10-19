from flask import Blueprint, request, jsonify
from services.jwt_service import validate_jwt_token
from services.vault_service import save_entry, get_vault_list, reveal_entry
from services.vault_service import delete_entry, update_entry
from services.vault_service import search_vault_items
from services.jwt_service import validate_jwt_token

vault_bp = Blueprint("vault", __name__)

@vault_bp.route("/vaults", methods=["GET"])
def get_vaults_route():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_data = validate_jwt_token(token)

    if "error" in user_data:
        return jsonify(user_data), 401

    response, status = get_vault_list(user_data["email"])
    return jsonify(response), status


@vault_bp.route("/save", methods=["POST"])
def save_password_route():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_data = validate_jwt_token(token)

    if "error" in user_data:
        return jsonify(user_data), 401

    data = request.get_json()
    site = data.get("site")
    username = data.get("username")
    encrypted_password = data.get("password")

    response, status = save_entry(user_data["email"], site, username, encrypted_password)
    return jsonify(response), status


@vault_bp.route("/reveal-password", methods=["POST"])
def reveal_password_route():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_data = validate_jwt_token(token)

    if "error" in user_data:
        return jsonify(user_data), 401

    data = request.get_json()
    site = data.get("site")
    username = data.get("username")

    response, status = reveal_entry(user_data["email"], site, username)
    return jsonify(response), status

@vault_bp.route("/update", methods=["PUT"])
def update_password_route():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_data = validate_jwt_token(token)

    if "error" in user_data:
        return jsonify(user_data), 401

    data = request.get_json()
    site = data.get("site")
    username = data.get("username")
    new_encrypted_password = data.get("password")

    response, status = update_entry(user_data["email"], site, username, new_encrypted_password)
    return jsonify(response), status

@vault_bp.route("/<site>/<username>", methods=["DELETE"])
def delete_password_route(site, username):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_data = validate_jwt_token(token)

    if "error" in user_data:
        return jsonify(user_data), 401

    email = user_data["email"]
    response, status = delete_entry(email, site, username)
    return jsonify(response), status

@vault_bp.route("/search", methods=["GET"])
def vault_search():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        return jsonify({"error": "Missing token"}), 401

    user = validate_jwt_token(token)
    if "error" in user:
        return jsonify(user), 401

    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"results": []})

    user_id = user["email"]
    vault_items, _ = get_vault_list(user_id)

    results = search_vault_items(query, vault_items)

    return jsonify({"results": results})
