import os
from typing import Any
from pathlib import Path


class Config:
    """Configuration management class for the Minecraft server management system."""

    _instance = None
    _config: dict[str, Any] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._load_config()
        return cls._instance

    def _load_config(self) -> None:
        """Load configuration from environment and defaults."""
        base_dir = Path(__file__).parent.parent
        self._config = {
            "servers_dir": base_dir / "data" / "servers",
            "backups_dir": base_dir / "data" / "backups",
            "database_dir": base_dir / "data" / "database",
            "database_path": base_dir / "data" / "database" / "database.db",
            "allowed_extensions": {"7z", "7zip"},
            "upload_folder": base_dir / "data" / "servers",
            "default_max_memory": 2048,
            "default_min_memory": 1024,
            "fabric_meta_url": "https://meta.fabricmc.net",
            "papermc_api_url": "https://api.papermc.io/v2",
            "forge_maven_url": "https://maven.minecraftforge.net",
            "log_level_patterns": {
                "ERROR": r"\[.*ERROR.*\]",
                "WARN": r"\[.*WARN.*\]",
                "INFO": r"\[.*INFO.*\]",
                "DEBUG": r"\[.*DEBUG.*\]",
            },
        }

    @property
    def servers_dir(self) -> Path:
        return self._config["servers_dir"]

    @property
    def backups_dir(self) -> Path:
        return self._config["backups_dir"]

    @property
    def database_dir(self) -> Path:
        return self._config["database_dir"]

    @property
    def database_path(self) -> Path:
        return self._config["database_path"]

    @property
    def allowed_extensions(self) -> set[str]:
        return self._config["allowed_extensions"]

    @property
    def upload_folder(self) -> Path:
        return self._config["upload_folder"]

    @property
    def default_max_memory(self) -> int:
        return self._config["default_max_memory"]

    @property
    def default_min_memory(self) -> int:
        return self._config["default_min_memory"]

    @property
    def fabric_meta_url(self) -> str:
        return self._config["fabric_meta_url"]

    @property
    def papermc_api_url(self) -> str:
        return self._config["papermc_api_url"]

    @property
    def forge_maven_url(self) -> str:
        return self._config["forge_maven_url"]

    @property
    def log_level_patterns(self) -> dict[str, str]:
        return self._config["log_level_patterns"]

    def get_server_dir(self, server_name: str) -> Path:
        return self.servers_dir / server_name

    def get_backup_dir(self) -> Path:
        os.makedirs(self.backups_dir, exist_ok=True)
        return self.backups_dir

    def get_logs_dir(self, server_name: str) -> Path:
        logs_dir = self.get_server_dir(server_name) / "logs"
        os.makedirs(logs_dir, exist_ok=True)
        return logs_dir

    def get_server_backup_dir(self, server_name: str) -> Path:
        """Get the backup directory for a specific server."""
        server_backup_dir = self.backups_dir / server_name
        os.makedirs(server_backup_dir, exist_ok=True)
        return server_backup_dir


config = Config()
