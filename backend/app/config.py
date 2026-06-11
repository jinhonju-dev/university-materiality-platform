from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "永續重大性評估平台 API"
    database_url: str = "sqlite:///./materiality.db"
    secret_key: str = "change-this-secret-in-production"
    access_token_minutes: int = 480
    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"
    frontend_origin: str = "http://localhost:3000"

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()

