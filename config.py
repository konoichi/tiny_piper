"""
Configuration management for TTS Server
"""
import os
from typing import Optional
from pydantic import BaseSettings

class Settings(BaseSettings):
    # Server settings
    host: str = "0.0.0.0"
    port: int = 5000
    debug: bool = False
    
    # TTS settings
    model_dir: str = "models"
    max_text_length: int = 500
    default_model: str = "en_GB-vctk-medium"
    default_speaker: str = "0"
    
    # Security settings
    enable_cors: bool = True
    allowed_origins: list = ["*"]
    rate_limit_requests: int = 60
    rate_limit_window: int = 60
    
    # Performance settings
    max_concurrent_requests: int = 10
    enable_caching: bool = True
    cache_ttl: int = 3600
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()