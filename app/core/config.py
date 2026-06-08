from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Hintro Meeting Intelligence"
    environment: str = "development"
    port: int = 8000

    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    database_url: str

    openai_api_key: str | None = None
    gemini_api_key: str | None = None

    slack_webhook_url: str | None = None
    discord_webhook_url: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()
