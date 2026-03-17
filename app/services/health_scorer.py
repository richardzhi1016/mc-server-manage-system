import logging
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

import psutil

from app.config import config

logger = logging.getLogger(__name__)

_NEUTRAL_TPS_SCORE = 70.0  # Used for vanilla servers without TPS data


class HealthGrade(str, Enum):
    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"

    @classmethod
    def from_score(cls, score: int) -> "HealthGrade":
        if score >= 80:
            return cls.GREEN
        if score >= 60:
            return cls.YELLOW
        return cls.RED


def compute_health_score(
    tps: Optional[float],
    cpu_pct: float,
    memory_pct: float,
) -> int:
    """
    Compute 0-100 health score.
      TPS weight:    40%
      Memory weight: 35%
      CPU weight:    25%
    """
    if tps is None:
        tps_score = _NEUTRAL_TPS_SCORE
    else:
        tps_score = min(tps, 20.0) / 20.0 * 100.0

    memory_score = max(0.0, (1.0 - memory_pct / 100.0) * 100.0)
    cpu_score = max(0.0, (1.0 - cpu_pct / 100.0) * 100.0)

    raw = tps_score * 0.40 + memory_score * 0.35 + cpu_score * 0.25
    return max(0, min(100, round(raw)))


@dataclass
class HealthSnapshot:
    server_name: str
    score: int
    grade: HealthGrade
    cpu: float
    memory_pct: float
    tps: Optional[float]
    timestamp: str


def take_snapshot(server_name: str, tps: Optional[float]) -> HealthSnapshot:
    """Compute current health score and persist to DB."""
    cpu = psutil.cpu_percent(interval=None)
    vm = psutil.virtual_memory()
    memory_pct = vm.percent

    score = compute_health_score(tps=tps, cpu_pct=cpu, memory_pct=memory_pct)
    grade = HealthGrade.from_score(score)
    ts = datetime.now(timezone.utc).isoformat()

    try:
        with sqlite3.connect(str(config.database_path)) as conn:
            conn.execute(
                """INSERT INTO health_snapshots
                   (server_name, score, cpu, memory_pct, tps, timestamp)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (server_name, score, cpu, memory_pct, tps, ts),
            )
    except Exception as e:
        logger.error("HealthScorer DB write failed: %s", e)

    return HealthSnapshot(
        server_name=server_name,
        score=score,
        grade=grade,
        cpu=cpu,
        memory_pct=memory_pct,
        tps=tps,
        timestamp=ts,
    )
