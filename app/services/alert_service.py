import json
import logging
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import IntEnum
from typing import Optional

import requests

from app.config import config

logger = logging.getLogger(__name__)

_REQUEST_TIMEOUT = 5  # seconds


class AlertColor(IntEnum):
    RED = 0xFF0000
    YELLOW = 0xFFAA00
    GREEN = 0x00CC44
    BLUE = 0x0099FF


@dataclass
class AlertEvent:
    server_name: str
    title: str
    message: str
    color: AlertColor
    fields: list = field(default_factory=list)
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    # --- Factory methods ---

    @classmethod
    def server_crashed(cls, server_name: str) -> "AlertEvent":
        return cls(
            server_name=server_name,
            title="🔴 服务器崩溃",
            message=f"服务器 **{server_name}** 意外退出。",
            color=AlertColor.RED,
        )

    @classmethod
    def auto_restart_pending(cls, server_name: str, reason: str) -> "AlertEvent":
        return cls(
            server_name=server_name,
            title="⚠️ 自动重启即将触发",
            message=f"服务器 **{server_name}** 将在 60 秒后自动重启。\n原因：`{reason}`",
            color=AlertColor.YELLOW,
        )

    @classmethod
    def auto_restart_executed(cls, server_name: str, reason: str) -> "AlertEvent":
        return cls(
            server_name=server_name,
            title="🔄 自动重启已执行",
            message=f"服务器 **{server_name}** 已完成自动重启。\n原因：`{reason}`",
            color=AlertColor.BLUE,
        )

    @classmethod
    def health_critical(cls, server_name: str, score: int) -> "AlertEvent":
        return cls(
            server_name=server_name,
            title="🔴 服务器健康状态危急",
            message=f"服务器 **{server_name}** 健康分降至 **{score}**（危险区间）。",
            color=AlertColor.RED,
        )

    @classmethod
    def health_recovered(cls, server_name: str, score: int) -> "AlertEvent":
        return cls(
            server_name=server_name,
            title="✅ 服务器健康恢复",
            message=f"服务器 **{server_name}** 健康分恢复至 **{score}**（良好区间）。",
            color=AlertColor.GREEN,
        )


def build_discord_payload(event: AlertEvent) -> dict:
    """Build Discord Webhook POST body from an AlertEvent."""
    return {
        "embeds": [
            {
                "title": event.title,
                "description": event.message,
                "color": int(event.color),
                "timestamp": event.timestamp,
                "fields": event.fields,
                "footer": {"text": f"mc-server-manage · {event.server_name}"},
            }
        ]
    }


def _get_webhook_urls(server_name: str) -> list:
    """Fetch all enabled Discord webhook URLs for this server from DB."""
    try:
        with sqlite3.connect(str(config.database_path)) as conn:
            rows = conn.execute(
                """SELECT config_json FROM alert_configs
                   WHERE server_name = ? AND type = 'discord_webhook' AND enabled = 1""",
                (server_name,),
            ).fetchall()
    except Exception as e:
        logger.error("Failed to fetch webhook URLs: %s", e)
        return []

    urls = []
    for (cfg_json,) in rows:
        try:
            cfg = json.loads(cfg_json)
            if cfg.get("webhook_url"):
                urls.append(cfg["webhook_url"])
        except Exception:
            pass
    return urls


def send(server_name: str, event: AlertEvent) -> None:
    """Dispatch alert to all configured channels for the server."""
    urls = _get_webhook_urls(server_name)
    payload = build_discord_payload(event)
    for url in urls:
        try:
            resp = requests.post(url, json=payload, timeout=_REQUEST_TIMEOUT)
            resp.raise_for_status()
        except Exception as e:
            logger.warning("Failed to send Discord alert to %s: %s", url, e)
