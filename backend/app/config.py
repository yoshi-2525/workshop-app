import logging
from pathlib import Path
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ directory, regardless of the process's current working directory
# (e.g. `npm run dev` at the repo root vs. running uvicorn from backend/).
BACKEND_DIR = Path(__file__).resolve().parent.parent

DEFAULT_JWT_SECRET_KEY = "dev-secret-change-me"
# HS256 の鍵として十分な長さ(32バイト)
MIN_JWT_SECRET_KEY_LENGTH = 32

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    # development 以外では、JWT の秘密鍵が初期値・短すぎる場合に起動を止める
    app_env: str = "development"
    db_host: str = "localhost"
    db_port: int = 3306
    db_user: str = "root"
    db_password: str = ""
    db_name: str = "workshop"
    jwt_secret_key: str = DEFAULT_JWT_SECRET_KEY
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24
    cors_origins: str = "http://localhost:5173"
    upload_dir: str = "uploads"
    max_upload_size_bytes: int = 5 * 1024 * 1024
    # ログイン失敗の上限。同じ IP・同じメールアドレスそれぞれで数える
    login_max_failures: int = 10
    login_failure_window_seconds: int = 15 * 60

    # カレントディレクトリに関係なく backend/.env を読む
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8")

    def check_jwt_secret(self) -> None:
        weak = (
            self.jwt_secret_key == DEFAULT_JWT_SECRET_KEY
            or len(self.jwt_secret_key) < MIN_JWT_SECRET_KEY_LENGTH
        )
        if not weak:
            return
        message = (
            f"JWT_SECRET_KEY が初期値か {MIN_JWT_SECRET_KEY_LENGTH} 文字未満です。"
            "`python -c \"import secrets; print(secrets.token_urlsafe(48))\"` などで生成した値を設定してください"
        )
        if self.app_env != "development":
            raise RuntimeError(message)
        logger.warning(message)

    @property
    def database_url(self) -> str:
        password = quote_plus(self.db_password)
        return f"mysql+pymysql://{self.db_user}:{password}@{self.db_host}:{self.db_port}/{self.db_name}"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def upload_path(self) -> Path:
        path = Path(self.upload_dir)
        return path if path.is_absolute() else BACKEND_DIR / path


settings = Settings()
