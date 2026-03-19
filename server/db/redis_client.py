import redis
from config import REDIS_URI

try:
    redis_client = redis.from_url(REDIS_URI, decode_responses=True)
    redis_client.ping()
    print("Connected to Redis successfully")
except Exception as e:
    print(f"Redis connection failed: {e}")
    redis_client = None