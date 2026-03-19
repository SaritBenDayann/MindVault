from flask import request
from flask_socketio import SocketIO, disconnect
from services.jwt_service import validate_jwt_token
from config import REDIS_URI
from db.redis_client import redis_client

socketio = SocketIO(cors_allowed_origins="*", message_queue=REDIS_URI)

@socketio.on('connect')
def handle_connect(auth):
    if not auth or 'token' not in auth:
        print("Connection rejected: No auth token provided")
        return False 
    
    token = auth['token']
    user_data = validate_jwt_token(token)
    
    if "error" in user_data:
        print(f"Connection rejected: {user_data['error']}")
        return False
        
    email = user_data["email"]
    sid = request.sid
    
    if redis_client:
        redis_client.sadd(f"socket:{email}", sid)
        redis_client.expire(f"socket:{email}", 7200)
        
        redis_client.setex(f"sid:{sid}", 7200, email)
        print(f"User {email} connected securely with SID: {sid} (Multiple tabs supported)")

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    if redis_client:
        email = redis_client.get(f"sid:{sid}")
        if email:
            redis_client.srem(f"socket:{email}", sid)
            
            redis_client.delete(f"sid:{sid}")
            print(f"User {email} disconnected tab with SID: {sid}")

def notify_user(email, event_name, data):
    if not redis_client:
        return
        
    user_sids = redis_client.smembers(f"socket:{email}")
    
    if user_sids:
        for sid in user_sids:
            socketio.emit(event_name, data, to=sid)