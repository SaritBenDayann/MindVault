from pymongo import MongoClient
from config import MONGO_URI

client = None
db = None

def connect_to_database():
    global client, db
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        client.server_info()
        db = client.MindVault
        print("Connected to MongoDB successfully")
        return True
    except Exception as e:
        print(f"MongoDB connection failed: {e}")
        print("Running in offline mode- database operations will fail")
        client = None
        db = None
        return False

connect_to_database()

