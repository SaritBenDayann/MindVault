import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

SECRET_KEY = os.environ.get("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable is required")
MONGO_URI = os.environ.get("MONGO_URI")
if not MONGO_URI:
    raise ValueError("MONGO_URI environment variable is required")

JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", SECRET_KEY) 
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DELTA = timedelta(hours=24)

CORS_ALLOWED_ORIGINS = os.environ.get("CORS_ALLOWED_ORIGINS", "*").split(",")

HIBP_PWNED_PASSWORDS_URL = "https://api.pwnedpasswords.com/range"
HIBP_RATE_LIMIT_DELAY = 1.0 

CRYPTO_STATIC_SALT = os.environ.get("CRYPTO_STATIC_SALT")
if not CRYPTO_STATIC_SALT:
    raise ValueError("CRYPTO_STATIC_SALT environment variable is required")
CRYPTO_ITERATIONS = int(os.environ.get("CRYPTO_ITERATIONS", "100000"))