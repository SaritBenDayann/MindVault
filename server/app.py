import eventlet
eventlet.monkey_patch()

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
import os

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

from flask import Flask
from flask_cors import CORS
from config import SECRET_KEY, CORS_ALLOWED_ORIGINS, JWT_ALGORITHM, JWT_EXPIRATION_DELTA
from routes import auth_bp, vault_bp
from routes.breach_routes import breach_bp
from db import db
from datetime import timedelta
from routes.audit_routes import audit_bp
from services.socketio_instance import socketio
from routes.llm_routes import llm_bp

def create_app():
    app = Flask(__name__)

    app.config["JWT_SECRET_KEY"] = SECRET_KEY
    app.config["JWT_ALGORITHM"] = JWT_ALGORITHM
    app.config["JWT_EXPIRATION_DELTA"] = JWT_EXPIRATION_DELTA

    app.db = db

    CORS(
        app,
        origins=[
            "http://localhost:5173", 
            "https://mindvault-security.vercel.app"
        ],
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    )
    socketio.init_app(app, cors_allowed_origins="*")

    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(vault_bp, url_prefix="/vault")
    app.register_blueprint(audit_bp)
    app.register_blueprint(breach_bp, url_prefix="/breach")
    app.register_blueprint(llm_bp)
    
    return app

if __name__ == "__main__":
    app = create_app()
    socketio.run(app, debug=True, host="0.0.0.0", port=5000)
