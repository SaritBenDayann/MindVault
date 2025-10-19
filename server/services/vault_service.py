from flask import current_app
from pymongo.errors import PyMongoError
from services.audit_service import log_audit_event
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import os, pickle, requests
from bs4 import BeautifulSoup

model = None
vectorizer = None
label_encoder = None

def load_models():
    global model, vectorizer, label_encoder

    if model and vectorizer and label_encoder:
        return

    MODEL_DIR = os.path.join(os.path.dirname(__file__), "../model")
    try:
        with open(os.path.join(MODEL_DIR, "model.pkl"), "rb") as f:
            model = pickle.load(f)

        with open(os.path.join(MODEL_DIR, "vectorizer.pkl"), "rb") as f:
            vectorizer = pickle.load(f)

        with open(os.path.join(MODEL_DIR, "label_encoder.pkl"), "rb") as f:
            label_encoder = pickle.load(f)

    except Exception as e:
        model = None
        vectorizer = None
        label_encoder = None


def get_site_description(site):
    headers = {
        'User-Agent': 'MindVault/1.0 (+https://github.com/your-repo/mindvault)'
    }
    site_trimmed = (site or "").strip()
    if not site_trimmed:
        return ""

    # ConceptNet
    try:
        term = site_trimmed.replace(' ', '_')
        cn_url = f"https://api.conceptnet.io/c/en/{term}"
        cn_resp = requests.get(cn_url, headers=headers, timeout=5)
        if cn_resp.status_code == 200:
            cn_data = cn_resp.json() or {}
            edges = cn_data.get('edges') or []
            for edge in edges:
                rel = (edge.get('rel', {}).get('label') or '').lower()
                start = edge.get('start', {}).get('label') or ''
                end = edge.get('end', {}).get('label') or ''
                if rel == 'is a' and start and end:
                    text = f"{start} is a {end}."
                    print(f"[DEBUG] Using ConceptNet IsA for {site_trimmed}")
                    return text
            for edge in edges:
                surface = (edge.get('surfaceText') or '').strip()
                if surface:
                    print(f"[DEBUG] Using ConceptNet surfaceText for {site_trimmed}")
                    return surface
    except Exception as e:
        print(f"[DEBUG] Failed to get ConceptNet description for {site_trimmed}: {e}")

    # Otherwise, Wikipedia summary
    try:
        wiki_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{site_trimmed}"
        response = requests.get(wiki_url, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            extract = data.get("extract", "").strip()
            if extract:
                print(f"[DEBUG] Using Wikipedia summary for {site_trimmed}")
                return extract
        else:
            print(f"[DEBUG] Wikipedia API returned status {response.status_code}")
    except Exception as e:
        print(f"[DEBUG] Failed to get Wikipedia description for {site_trimmed}: {e}")
    return ""


def predict_tag_from_site(site):
    load_models()

    if not model or not vectorizer or not label_encoder:
        print("Model components are not loaded, returning 'other'")
        return "other"

    description = get_site_description(site)
    if not description:
        return "other"

    try:
        X = vectorizer.transform([description])
        y_pred = model.predict(X)
        return label_encoder.inverse_transform(y_pred)[0]
    except Exception as e:
        print(f"Prediction failed: {e}")
        return "other"


def save_entry(user_email, site, username, encrypted_password):
    if not site or not username or not encrypted_password:
        return {"error": "Missing fields"}, 400

    db = current_app.db
    
    tag = predict_tag_from_site(site)
    print(f"Predicted tag for {site}: {tag}")
    
    try:
        vault_entry = {
            "userEmail": user_email,
            "site": site,
            "username": username,
            "password": encrypted_password,
            "tag": tag
        }
        
        db.vaults.insert_one(vault_entry)
        log_audit_event(user_email, f"password_added:{site}/{username}")
        return {"message": "Password saved successfully", "tag": tag}, 201

    except PyMongoError as e:
        return {"error": "Database error"}, 500



def get_vault_list(user_email):
    db = current_app.db
    if db is None:
        # Offline mode: no DB connection. Return empty list gracefully.
        return [], 200
    try:
        entries = db.vaults.find({"userEmail": user_email})
        result = [
            {
                "site": e.get("site", ""),
                "username": e.get("username", ""),
                "tag": e.get("tag", "")
            }
            for e in entries
        ]
        return result, 200
    except PyMongoError:
        return {"error": "Database error"}, 500
    except Exception as e:
        print("Vault list error:", e)
        return {"error": "Unknown error"}, 500



def reveal_entry(user_email, site, username):
    db = current_app.db
    entry = db.vaults.find_one({
        "userEmail": user_email,
        "site": site,
        "username": username
    })

    if not entry:
        return {"error": "Entry not found"}, 404

    log_audit_event(user_email, f"password_revealed:{site}/{username}")

    return {"password": entry["password"]}, 200

def update_entry(user_email, site, username, new_encrypted_password):
    if not site or not username or not new_encrypted_password:
        return {"error": "Missing fields"}, 400

    db = current_app.db
    
    try:
        existing_entry = db.vaults.find_one({
            "userEmail": user_email,
            "site": site,
            "username": username
        })
        
        if not existing_entry:
            return {"error": "Entry not found"}, 404
        
        result = db.vaults.update_one(
            {
                "userEmail": user_email,
                "site": site,
                "username": username
            },
            {
                "$set": {"password": new_encrypted_password}
            }
        )
        
        if result.modified_count == 1:
            log_audit_event(user_email, f"password_updated:{site}/{username}")
            return {"message": "Password updated successfully"}, 200
        else:
            return {"error": "Failed to update password"}, 500
            
    except PyMongoError as e:
        return {"error": "Database error"}, 500

def delete_entry(user_email, site, username):
    db = current_app.db
    try:
        result = db.vaults.delete_one({
            "userEmail": user_email,
            "site": site,
            "username": username
        })
        
        if result.deleted_count == 1:
            log_audit_event(user_email, f"password_deleted:{site}/{username}") 
            return {"message": "Entry deleted successfully"}, 200
        else:
            return {"error": "Entry not found"}, 404
    except PyMongoError as e:
        return {"error": "Database error"}, 500


def search_vault_items(query, vault_items):
    if not vault_items or not query.strip():
        return []

    documents = [
        " ".join([item.get("site", ""), item.get("username", ""), item.get("tag", "")])
        for item in vault_items
    ]

    vectorizer = TfidfVectorizer(
        lowercase=True,
        stop_words='english',
        max_features=5000,
        ngram_range=(1, 2),
        min_df=1
    )

    try:
        tfidf_matrix = vectorizer.fit_transform(documents)
        query_vector = vectorizer.transform([query])
    except ValueError:
        return []

    similarities = cosine_similarity(query_vector, tfidf_matrix).flatten()
    ranked_items = [
        (item, similarity)
        for item, similarity in zip(vault_items, similarities)
        if similarity > 0
    ]
    ranked_items.sort(key=lambda x: x[1], reverse=True)

    return [item for item, _ in ranked_items]
