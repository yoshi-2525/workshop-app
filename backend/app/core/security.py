from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import settings

# bcrypt は先頭 72 バイトしか使わない。登録時は schemas/user.py でこれを超えるパスワードを弾く
BCRYPT_MAX_BYTES = 72

# 存在しないユーザーでログインされたときにも同じだけ bcrypt を実行し、
# 応答時間の差から登録済みのメールアドレスを推測されないようにする
_DUMMY_HASH = bcrypt.hashpw(b"dummy-password", bcrypt.gensalt())


def hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")[:BCRYPT_MAX_BYTES]
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    # 以前は 72 バイトを超える入力を切り詰めて保存していたため、照合も同じく切り詰める
    password_bytes = password.encode("utf-8")[:BCRYPT_MAX_BYTES]
    return bcrypt.checkpw(password_bytes, hashed_password.encode("utf-8"))


def burn_password_check(password: str) -> None:
    """照合相手がいないときに verify_password と同じだけ時間を使う"""
    bcrypt.checkpw(password.encode("utf-8")[:BCRYPT_MAX_BYTES], _DUMMY_HASH)


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> int | None:
    """有効なトークンならユーザー ID を返す。無効・期限切れ・形式不正なら None"""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["sub", "exp"]},
        )
    except jwt.PyJWTError:
        return None
    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject.isdigit():
        return None
    return int(subject)
