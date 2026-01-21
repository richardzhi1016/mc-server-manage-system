import os
import jwt
import bcrypt
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, g
from typing import Optional, Dict, Any

JWT_SECRET_KEY = (
    os.environ.get("JWT_SECRET_KEY") or "default-secret-key-change-in-production"
)
JWT_EXPIRATION_HOURS = 24


def hash_password(password: str) -> str:
    """Hash password using bcrypt with cost factor 12."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Verify password against hash using bcrypt constant-time comparison."""
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def generate_token(user_id: str, username: str, role: str) -> str:
    """Generate JWT token with user information."""
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm="HS256")


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate JWT token. Returns payload or None if invalid."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_token_from_header() -> Optional[str]:
    """Extract JWT token from Authorization header."""
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1]


def require_auth(f):
    """Decorator to require valid JWT token for endpoint access."""

    @wraps(f)
    def decorated(*args, **kwargs):
        token = get_token_from_header()
        if not token:
            return jsonify({"error": "Missing authentication token"}), 401

        payload = decode_token(token)
        if not payload:
            return jsonify({"error": "Invalid or expired token"}), 401

        g.auth_user = {
            "user_id": payload.get("sub"),
            "username": payload.get("username"),
            "role": payload.get("role"),
        }
        return f(*args, **kwargs)

    return decorated


def require_admin(f):
    """Decorator to require admin role for endpoint access."""

    @wraps(f)
    @require_auth
    def decorated(*args, **kwargs):
        if g.auth_user.get("role") != "admin":
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)

    return decorated
