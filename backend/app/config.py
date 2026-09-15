from pathlib import Path
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ directory, regardless of the process's current working directory
# (e.g. `npm run dev` at the repo root vs. running uvicorn from backend/).
BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    db_host: str = "localhost"
    db_port: int = 3306
    db_user: str = "root"
    db_password: str = ""
    db_name: str = "workshop"
    jwt_secret_key: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24
    cors_origins: str = "http://localhost:5173"
    upload_dir: str = "uploads"
    max_upload_size_bytes: int = 5 * 1024 * 1024

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

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
