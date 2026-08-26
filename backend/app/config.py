from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ENV_FILE = _BACKEND_DIR / ".env"


def normalize_database_url(value: str) -> str:
    url = value.strip()
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://") :]
    if "render.com" in url and "sslmode=" not in url:
        url += ("&" if "?" in url else "?") + "sslmode=require"
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Mi Planificador Personal"
    database_url: str = "sqlite:///./data/planner.db"
    cors_origins: str = "http://localhost:4200,http://127.0.0.1:4200"
    secret_key: str = "organi-day-dev-change-me"
    access_token_minutes: int = 15
    refresh_token_days: int = 30

    @field_validator("database_url", mode="before")
    @classmethod
    def _database_url(cls, value: object) -> str:
        if not value:
            return "sqlite:///./data/planner.db"
        return normalize_database_url(str(value))

    @property
    def origins(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


settings = Settings()
