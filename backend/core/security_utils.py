try:
    from cryptography.fernet import Fernet
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False

import os
import base64
from typing import Optional

# For MVP, we use a fixed key if not in .env
# In prod, this MUST be a 32-byte base64 encoded string
SECRET_CIPHER_KEY = os.getenv("DRISHYAM_CIPHER_KEY", os.getenv("DRISHYAM_CIPHER_KEY", "uN7f_pS_X_Z_Q_Z_R_Y_Z_X_Z_Q_Z_R_Y_Z_X_Z_Q_Z_R_Y="))

def get_cipher():
    if not HAS_CRYPTO:
        return None
    try:
        return Fernet(SECRET_CIPHER_KEY)
    except Exception:
        # Fallback for dev if key is invalid
        key = base64.urlsafe_b64encode(b"01234567890123456789012345678901")
        return Fernet(key)

cipher = get_cipher()

def encrypt_pii(data: Optional[str]) -> Optional[str]:
    if not data or not cipher:
        return data
    try:
        return cipher.encrypt(data.encode()).decode()
    except Exception:
        return data

def decrypt_pii(cipher_text: Optional[str]) -> Optional[str]:
    if not cipher_text or not cipher:
        return cipher_text
    try:
        return cipher.decrypt(cipher_text.encode()).decode()
    except Exception:
        return cipher_text
