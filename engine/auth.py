"""
Authentication & Session Security Module for MindMePredict Strangle Desk.
Provides zero-dependency, cryptographically secure PBKDF2 password hashing,
tamper-proof HMAC-SHA256 signed session tokens, and FastAPI security dependencies.
"""

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Optional, Dict, Any
from fastapi import Header, Query, HTTPException, status

# -------------------------------------------------------------
# Secret Key Persistence
# -------------------------------------------------------------
_root_dir = os.path.dirname(os.path.dirname(__file__))
_data_dir = os.path.join(_root_dir, "data")
_default_file = os.path.join(_data_dir, ".secret_key") if os.path.isdir(_data_dir) else os.path.join(_root_dir, ".secret_key")

SECRET_KEY_FILE = os.getenv("SECRET_KEY_PATH", _default_file)

def _load_or_generate_secret_key() -> bytes:
    """Load persistent secret key from env or local secure file."""
    env_secret = os.getenv("TERMINAL_SECRET_KEY")
    if env_secret:
        return env_secret.encode("utf-8")
    
    if os.path.exists(SECRET_KEY_FILE):
        try:
            with open(SECRET_KEY_FILE, "r", encoding="utf-8") as f:
                key = f.read().strip()
                if key:
                    return key.encode("utf-8")
        except Exception:
            pass

    # Generate fresh 256-bit cryptographically secure key
    new_key = secrets.token_hex(32)
    try:
        with open(SECRET_KEY_FILE, "w", encoding="utf-8") as f:
            f.write(new_key)
    except Exception as e:
        print(f"[AUTH WARN] Could not persist secret key to {SECRET_KEY_FILE}: {e}")
    return new_key.encode("utf-8")


_SECRET_KEY: bytes = _load_or_generate_secret_key()
TOKEN_EXPIRY_SECONDS = 7 * 24 * 3600  # 7 days session lifetime


# -------------------------------------------------------------
# Password Hashing & Verification (PBKDF2-HMAC-SHA256)
# -------------------------------------------------------------
def hash_password(password: str) -> str:
    """Hash a password using PBKDF2-HMAC-SHA256 with a unique 16-byte salt."""
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return f"{salt.hex()}:{dk.hex()}"


def verify_password(plain_password: str, hashed_str: str) -> bool:
    """Verify a plaintext password against a stored salt:hash string."""
    try:
        salt_hex, key_hex = hashed_str.split(":", 1)
        salt = bytes.fromhex(salt_hex)
        expected_key = bytes.fromhex(key_hex)
        dk = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, 100_000)
        return hmac.compare_digest(dk, expected_key)
    except Exception:
        return False


# -------------------------------------------------------------
# Base64URL Encoding Helpers
# -------------------------------------------------------------
def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    padding = 4 - (len(s) % 4)
    if padding < 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s.encode("ascii"))


# -------------------------------------------------------------
# Tamper-Proof HMAC Session Token Generation & Verification
# -------------------------------------------------------------
def create_access_token(user_data: Dict[str, Any], expiry_seconds: int = TOKEN_EXPIRY_SECONDS) -> str:
    """
    Creates a signed HMAC-SHA256 session token containing user details and expiration.
    Format: <base64url_payload>.<base64url_signature>
    """
    now = int(time.time())
    payload = {
        "sub": user_data.get("username"),
        "role": user_data.get("role", "Risk Officer"),
        "name": user_data.get("name", "Desk Trader"),
        "desk": user_data.get("desk", "NIFTY-ALPHA-01"),
        "iat": now,
        "exp": now + expiry_seconds,
        "nonce": secrets.token_hex(6)
    }
    payload_json = json.dumps(payload, separators=(',', ':'), sort_keys=True).encode("utf-8")
    payload_b64 = _b64url_encode(payload_json)
    
    # Compute signature
    signature = hmac.new(_SECRET_KEY, payload_b64.encode("ascii"), hashlib.sha256).digest()
    sig_b64 = _b64url_encode(signature)
    
    return f"{payload_b64}.{sig_b64}"


def verify_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verifies token signature and checks expiration.
    Returns payload dictionary if valid, or None if expired/tampered.
    """
    if not token or "." not in token:
        return None
    try:
        parts = token.strip().split(".")
        if len(parts) != 2:
            return None
        payload_b64, sig_b64 = parts[0], parts[1]
        
        # Verify HMAC signature
        expected_sig = hmac.new(_SECRET_KEY, payload_b64.encode("ascii"), hashlib.sha256).digest()
        provided_sig = _b64url_decode(sig_b64)
        if not hmac.compare_digest(expected_sig, provided_sig):
            return None
        
        # Parse payload
        payload_bytes = _b64url_decode(payload_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))
        
        # Check expiration
        now = int(time.time())
        if payload.get("exp", 0) < now:
            return None
        
        return payload
    except Exception:
        return None


# -------------------------------------------------------------
# User Store & Authentication
# -------------------------------------------------------------
# Default institutional quant desk operator
DEFAULT_USERNAME = os.getenv("DESK_USERNAME", "admin")
DEFAULT_PASSWORD = os.getenv("DESK_PASSWORD", "nifty2026")
DEFAULT_FULLNAME = os.getenv("DESK_FULLNAME", "Quant Risk Lead")

# Pre-computed hash of default password for constant-time comparisons
_USERS_DB: Dict[str, Dict[str, Any]] = {
    DEFAULT_USERNAME.lower(): {
        "username": DEFAULT_USERNAME,
        "password_hash": hash_password(DEFAULT_PASSWORD),
        "name": DEFAULT_FULLNAME,
        "role": "Chief Risk Officer & Lead Options Trader",
        "desk": "NSE-ST-DESK-01"
    }
}


def authenticate_user(username: str, plain_pass: str) -> Optional[Dict[str, Any]]:
    """
    Validates username and password. Returns user profile dict without password hash,
    or None if credentials are invalid.
    """
    if not username or not plain_pass:
        return None
    user = _USERS_DB.get(username.strip().lower())
    if not user:
        return None
    if verify_password(plain_pass, user["password_hash"]):
        return {
            "username": user["username"],
            "name": user["name"],
            "role": user["role"],
            "desk": user["desk"]
        }
    return None


# -------------------------------------------------------------
# FastAPI Dependency for Route Protection
# -------------------------------------------------------------
def get_current_user(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None)
) -> Dict[str, Any]:
    """
    Extracts and validates session token from either:
    1. Authorization header: "Bearer <token>"
    2. Query parameter: ?token=<token> (useful for EventSource SSE)
    Raises 401 Unauthorized if missing, expired, or tampered.
    """
    extracted_token = None
    if authorization and authorization.lower().startswith("bearer "):
        extracted_token = authorization[7:].strip()
    elif token:
        extracted_token = token.strip()
    
    if not extracted_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in to access the Quant Desk terminal.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    payload = verify_access_token(extracted_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or token is invalid. Please re-authenticate.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    return {
        "username": payload.get("sub"),
        "role": payload.get("role"),
        "name": payload.get("name"),
        "desk": payload.get("desk")
    }

