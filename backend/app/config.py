from functools import lru_cache
from urllib.parse import urlsplit

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_origin(value: str) -> str:
    parsed = urlsplit(value)
    if parsed.scheme and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}"
    return value.rstrip("/")


class Settings(BaseSettings):
    app_name: str = "University Materiality Platform API"
    app_env: str = "production"
    app_mode: str = "production"
    database_url: str = "sqlite:///./materiality.db"
    secret_key: str = "change-this-secret-in-production"
    access_token_minutes: int = Field(
        default=120,
        validation_alias=AliasChoices("ACCESS_TOKEN_MINUTES", "JWT_EXPIRE_MINUTES"),
    )
    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"
    frontend_origin: str = Field(
        default="https://jinhonju-dev.github.io",
        validation_alias=AliasChoices("FRONTEND_ORIGIN", "FRONTEND_URL"),
    )
    extra_cors_origins: str = Field(
        default="",
        validation_alias=AliasChoices("EXTRA_CORS_ORIGINS", "CORS_ALLOWED_ORIGINS"),
    )
    seed_demo_accounts: bool = False
    bootstrap_admin_email: str | None = None
    bootstrap_admin_password: str | None = None

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        origins = [normalize_origin(self.frontend_origin)]
        origins.extend(normalize_origin(origin.strip()) for origin in self.extra_cors_origins.split(",") if origin.strip())
        if self.app_env.lower() != "production" and self.app_mode.lower() != "production":
            origins.extend(["http://localhost:3000", "http://127.0.0.1:3000"])
        return list(dict.fromkeys(origin for origin in origins if origin))


@lru_cache
def get_settings() -> Settings:
    return Settings()
