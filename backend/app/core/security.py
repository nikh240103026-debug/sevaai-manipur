import hashlib
import hmac
import secrets


_PASSWORD_ITERATIONS = 600_000
_SALT_BYTES = 16
_DUMMY_PASSWORD_HASH = (
    "pbkdf2_sha256$600000$"
    "7365617661692d6c6f67696e2d64756d6d79$"
    "6a16fca4a661461c7fe5b3b20769aa754a51c120fcd1d44951261ea91f7ad787"
)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(_SALT_BYTES)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, _PASSWORD_ITERATIONS
    )
    return f"pbkdf2_sha256${_PASSWORD_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored_hash: str | None) -> bool:
    candidate_hash = stored_hash or _DUMMY_PASSWORD_HASH
    try:
        algorithm, iterations_text, salt_hex, digest_hex = candidate_hash.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        iterations = int(iterations_text)
        if iterations < 1 or iterations > 2_000_000:
            return False
        salt = bytes.fromhex(salt_hex)
        expected_digest = bytes.fromhex(digest_hex)
    except (ValueError, TypeError):
        return False

    actual_digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, iterations
    )
    return hmac.compare_digest(actual_digest, expected_digest)


def create_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
