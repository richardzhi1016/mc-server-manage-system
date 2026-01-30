import os
from typing import Any
from pathlib import Path

SERVERS_DIR = "servers"
STARTUP_CONF = "startup.conf"


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
            "backups_dir": base_dir / "backups",
            "database_dir": base_dir / "data" / "database",
            "database_path": base_dir / "data" / "database" / "database.db",
            "allowed_extensions": {"7z", "7zip"},
            "upload_folder": base_dir / "data" / "servers",
            "default_max_memory": 2048,
            "default_min_memory": 1024,
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


config = Config()


def get_server_dir(server_name: str) -> str:
    """Get the absolute path to a server directory."""
    return os.path.abspath(os.path.join(SERVERS_DIR, server_name))


def read_startup_conf(server_name: str) -> dict[str, Any]:
    """Read startup configuration for a server."""
    server_dir = get_server_dir(server_name)
    conf_path = os.path.join(server_dir, STARTUP_CONF)

    defaults = {
        "min_memory": 1024,
        "max_memory": 2048,
        "jvm_flags": ["-nogui"],
    }

    if not os.path.exists(conf_path):
        return defaults

    config = defaults.copy()
    try:
        with open(conf_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, value = line.split("=", 1)
                    key = key.strip()
                    value = value.strip()
                    if key == "min_memory":
                        config["min_memory"] = int(value)
                    elif key == "max_memory":
                        config["max_memory"] = int(value)
                    elif key == "jvm_flags":
                        config["jvm_flags"] = value.split()
    except Exception:
        pass

    return config


def write_startup_conf(server_name: str, config: dict[str, Any]) -> bool:
    """Write startup configuration for a server."""
    server_dir = get_server_dir(server_name)
    conf_path = os.path.join(server_dir, STARTUP_CONF)

    try:
        os.makedirs(server_dir, exist_ok=True)
        with open(conf_path, "w", encoding="utf-8") as f:
            f.write(f"min_memory={config.get('min_memory', 1024)}\n")
            f.write(f"max_memory={config.get('max_memory', 2048)}\n")
            flags = config.get("jvm_flags", ["-nogui"])
            f.write(f"jvm_flags={' '.join(flags)}\n")
        return True
    except Exception:
        return False


def read_server_properties(server_name: str) -> dict[str, str]:
    """Read server.properties file for a server."""
    server_dir = get_server_dir(server_name)
    props_path = os.path.join(server_dir, "server.properties")

    properties = {}

    if os.path.exists(props_path):
        try:
            with open(props_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        key, value = line.split("=", 1)
                        properties[key.strip()] = value.strip()
        except Exception:
            pass

    return properties


def write_server_properties(server_name: str, properties: dict[str, str]) -> bool:
    """Write server.properties file for a server."""
    server_dir = get_server_dir(server_name)
    props_path = os.path.join(server_dir, "server.properties")

    try:
        os.makedirs(server_dir, exist_ok=True)
        with open(props_path, "w", encoding="utf-8") as f:
            for key, value in properties.items():
                f.write(f"{key}={value}\n")
        return True
    except Exception:
        return False


def build_java_command(server_name: str) -> list[str]:
    """Build the Java command for starting a server."""
    config = read_startup_conf(server_name)
    jar_file = find_server_jar(server_name)

    if not jar_file:
        return []

    min_mem = config.get("min_memory", 1024)
    max_mem = config.get("max_memory", 2048)
    jvm_flags = config.get("jvm_flags", ["-nogui"])

    jar_path = os.path.join(get_server_dir(server_name), jar_file)

    cmd = ["java"]
    cmd.extend(["-Xms", f"{min_mem}m"])
    cmd.extend(["-Xmx", f"{max_mem}m"])
    cmd.extend(jvm_flags)
    cmd.extend(["-jar", jar_path, "nogui"])

    return cmd


def find_server_jar(server_name: str) -> str | None:
    """Find the server JAR file in the server directory."""
    server_dir = get_server_dir(server_name)
    if not os.path.exists(server_dir):
        return None
    for file in os.listdir(server_dir):
        if file.endswith(".jar"):
            return file
    return None


SERVER_PROPERTIES_SCHEMA = {
    "server-ip": {"type": "text", "default": "", "label": "Server IP"},
    "server-port": {
        "type": "number",
        "default": 25565,
        "min": 1,
        "max": 65535,
        "label": "Server Port",
    },
    "spawn-protection": {
        "type": "number",
        "default": 16,
        "min": 0,
        "max": 100,
        "label": "Spawn Protection",
    },
    "max-players": {
        "type": "number",
        "default": 20,
        "min": 1,
        "max": 1000,
        "label": "Max Players",
    },
    "view-distance": {
        "type": "number",
        "default": 10,
        "min": 3,
        "max": 32,
        "label": "View Distance",
    },
    "simulation-distance": {
        "type": "number",
        "default": 10,
        "min": 3,
        "max": 32,
        "label": "Simulation Distance",
    },
    "allow-flight": {"type": "boolean", "default": False, "label": "Allow Flight"},
    "allow-nether": {"type": "boolean", "default": True, "label": "Allow Nether"},
    "enable-command-block": {
        "type": "boolean",
        "default": False,
        "label": "Enable Command Blocks",
    },
    "force-gamemode": {"type": "boolean", "default": False, "label": "Force Gamemode"},
    "gamemode": {
        "type": "select",
        "options": ["survival", "creative", "adventure", "spectator"],
        "default": "survival",
        "label": "Gamemode",
    },
    "difficulty": {
        "type": "select",
        "options": ["peaceful", "easy", "normal", "hard"],
        "default": "normal",
        "label": "Difficulty",
    },
    "level-name": {"type": "text", "default": "world", "label": "World Name"},
    "level-seed": {"type": "text", "default": "", "label": "World Seed"},
    "level-type": {
        "type": "select",
        "options": [
            "minecraft:normal",
            "minecraft:flat",
            "minecraft:large_biomes",
            "minecraft:amplified",
        ],
        "default": "minecraft:normal",
        "label": "World Type",
    },
    "generate-structures": {
        "type": "boolean",
        "default": True,
        "label": "Generate Structures",
    },
    "hardcore": {"type": "boolean", "default": False, "label": "Hardcore Mode"},
    "white-list": {"type": "boolean", "default": False, "label": "Enable Whitelist"},
    "enforce-whitelist": {
        "type": "boolean",
        "default": False,
        "label": "Enforce Whitelist",
    },
    "pvp": {"type": "boolean", "default": True, "label": "Enable PvP"},
    "spawn-animals": {"type": "boolean", "default": True, "label": "Spawn Animals"},
    "spawn-monsters": {"type": "boolean", "default": True, "label": "Spawn Monsters"},
    "spawn-npcs": {"type": "boolean", "default": True, "label": "Spawn NPCs"},
    "broadcast-console-to-ops": {
        "type": "boolean",
        "default": True,
        "label": "Broadcast Console to Ops",
    },
    "query.port": {
        "type": "number",
        "default": 25565,
        "min": 1,
        "max": 65535,
        "label": "Query Port",
    },
    "enable-query": {"type": "boolean", "default": False, "label": "Enable Query"},
    "enable-rcon": {"type": "boolean", "default": False, "label": "Enable RCON"},
    "rcon.password": {"type": "text", "default": "", "label": "RCON Password"},
    "rcon.port": {
        "type": "number",
        "default": 25575,
        "min": 1,
        "max": 65535,
        "label": "RCON Port",
    },
    "resource-pack": {"type": "text", "default": "", "label": "Resource Pack URL"},
    "resource-pack-sha1": {
        "type": "text",
        "default": "",
        "label": "Resource Pack SHA1",
    },
    "require-resource-pack": {
        "type": "boolean",
        "default": False,
        "label": "Require Resource Pack",
    },
    "server-name": {
        "type": "text",
        "default": "Dedicated Server",
        "label": "Server Name",
    },
}
