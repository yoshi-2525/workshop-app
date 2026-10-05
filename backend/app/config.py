import logging
from pathlib import Path
from urllib.parse import quote_plus

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ ディレクトリ。プロセスのカレントディレクトリに関係なく決まる
# (リポジトリ直下で `npm run dev` した場合も、backend/ で uvicorn を起動した場合も同じ)
BACKEND_DIR = Path(__file__).resolve().parent.parent

DEFAULT_JWT_SECRET_KEY = "dev-secret-change-me"
# HS256 の鍵として十分な長さ(32バイト)
MIN_JWT_SECRET_KEY_LENGTH = 32
# Stripe のテスト環境の秘密鍵の接頭辞。本番で使っていたら警告する
STRIPE_TEST_KEY_PREFIX = "sk_test_"

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    # development 以外では、JWT の秘密鍵が初期値・短すぎる場合に起動を止める。
    # 設定し忘れたときに弱い鍵のまま本番で動かないよう、初期値は production にする
    app_env: str = "production"
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
    # Stripe(参加費のオンライン決済)。秘密鍵が空ならオンライン決済は使えない(当日払いだけになる)
    stripe_secret_key: str = ""
    # Connect 用の Webhook エンドポイントの署名シークレット(whsec_...)
    stripe_webhook_secret: str = ""
    # Stripe の画面(Checkout・受け取り設定)から戻ってくる先。末尾の / は付けない
    frontend_base_url: str = "http://localhost:5173"
    # 運営の手数料(参加費に対する %)。Stripe の決済手数料とは別に主催者が負担する
    platform_fee_percent: int = 0

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

    @field_validator("frontend_base_url")
    @classmethod
    def _strip_trailing_slash(cls, value: str) -> str:
        # 後ろにパスをつなげて戻り先の URL を作るので、末尾の / は取り除く
        return value.rstrip("/")

    def check_stripe_settings(self) -> None:
        """オンライン決済の設定を確かめる。鍵がなくても起動は止めず、オンライン決済を使えないだけにする"""
        if not self.stripe_secret_key:
            logger.info("STRIPE_SECRET_KEY が未設定のため、オンライン決済は使えません")
            return
        if not self.stripe_webhook_secret:
            logger.warning("STRIPE_WEBHOOK_SECRET が未設定です。決済の完了を受け取れません")
        if self.app_env == "production" and self.stripe_secret_key.startswith(STRIPE_TEST_KEY_PREFIX):
            logger.warning("本番環境で Stripe のテスト用の秘密鍵を使っています")
        if self.app_env == "production" and not self.frontend_base_url.startswith("https://"):
            # 本番の Stripe は https 以外の戻り先を受け付けないので、受け取り設定や決済がすべて失敗する
            raise RuntimeError("本番では FRONTEND_BASE_URL を https:// で始まる URL にしてください")
        if not 0 <= self.platform_fee_percent < 100:
            raise RuntimeError("PLATFORM_FEE_PERCENT は 0 以上 100 未満で設定してください")

    @property
    def online_payment_enabled(self) -> bool:
        return bool(self.stripe_secret_key)

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
