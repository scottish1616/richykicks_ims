"""
Central application configuration.
All values are read from environment variables (.env locally) - nothing
security-sensitive is ever hardcoded here. See .env.example for the full
list of variables this app expects.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str

    # Auth
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Email
    RESEND_API_KEY: str = ""

    # CORS
    FRONTEND_ORIGIN: str = "http://localhost:3000"

    # Rate limiting
    LOGIN_RATE_LIMIT: str = "5/minute"
    PASSWORD_RESET_RATE_LIMIT: str = "3/minute"

    # App
    ENVIRONMENT: str = "development"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"


settings = Settings()
