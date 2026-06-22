from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "University Materiality Platform API"
    database_url: str = "sqlite:///./materiality.db"
    secret_key: str = "change-this-secret-in-production"
    access_token_minutes: int = 480
    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"
    frontend_origin: str = "http://localhost:3000"
    extra_cors_origins: str = ""
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
        origins = [self.frontend_origin, "http://127.0.0.1:3000"]
        origins.extend(origin.strip() for origin in self.extra_cors_origins.split(",") if origin.strip())
        return origins


@lru_cache
def get_settings() -> Settings:
    return Settings()
