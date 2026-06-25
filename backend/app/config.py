from functools import lru_cache
from urllib.parse import urlsplit

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


DATABASE_URL_ERROR = (
    "Invalid DATABASE_URL for production. "
    "Please set DATABASE_URL in Render Environment Variables. "
    "Use a Supabase PostgreSQL URL such as postgresql+psycopg://USER:PASSWORD@HOST:5432/postgres. "
    "If the Supabase password contains special characters, URL encode the password. "
    "Do not wrap the value in quotes and do not include a DATABASE_URL= prefix."
)


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
    initial_admin_enabled: bool = False
    initial_admin_email: str | None = None
    initial_admin_name: str = "Administrator"
    initial_admin_password: str | None = None
    initial_admin_force_password_change: bool = True
    reset_initial_admin_password: bool = False

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

    @property
    def production_mode(self) -> bool:
        return self.app_env.lower() == "production" or self.app_mode.lower() == "production"

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.database_url.startswith("postgresql://"):
            return self.database_url.replace("postgresql://", "postgresql+psycopg://", 1)
        return self.database_url

    def validate_database_url(self) -> None:
        if self.app_env.lower() == "test" or not self.production_mode:
            return
        value = self.database_url.strip()
        invalid_examples = {
            "",
            "<Supabase PostgreSQL connection string>",
            "Supabase PostgreSQL connection string",
            "postgresql+psycopg://<user>:<password>@<host>:5432/<database>",
            "postgresql+psycopg://<user>:<password>@<host>:5432/<db>",
        }
        if (
            value in invalid_examples
            or "<" in value
            or ">" in value
            or value.startswith(("'", '"'))
            or value.endswith(("'", '"'))
            or value.lower().startswith("database_url=")
            or not value.startswith(("postgresql+psycopg://", "postgresql://"))
        ):
            raise RuntimeError(DATABASE_URL_ERROR)


@lru_cache
def get_settings() -> Settings:
    return Settings()
