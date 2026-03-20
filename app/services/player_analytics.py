import sqlite3
import logging
from datetime import datetime, timezone

from app.config import config

logger = logging.getLogger(__name__)


class PlayerAnalyticsService:
    """Records player sessions and provides aggregate analytics queries."""

    def record_join(self, server_name: str, username: str) -> None:
        try:
            with sqlite3.connect(str(config.database_path)) as conn:
                conn.execute(
                    "INSERT INTO player_sessions(server_name, username, join_at) VALUES(?,?,?)",
                    (server_name, username, datetime.now(timezone.utc).isoformat()),
                )
        except Exception as e:
            logger.error("record_join failed for %s/%s: %s", server_name, username, e)

    def record_leave(self, server_name: str, username: str) -> None:
        try:
            with sqlite3.connect(str(config.database_path)) as conn:
                conn.execute(
                    """UPDATE player_sessions SET leave_at = ?
                       WHERE server_name = ? AND username = ? AND leave_at IS NULL""",
                    (datetime.now(timezone.utc).isoformat(), server_name, username),
                )
        except Exception as e:
            logger.error("record_leave failed for %s/%s: %s", server_name, username, e)

    def close_all_sessions(self, server_name: str) -> None:
        """Called on server stop/crash — close any open sessions."""
        try:
            with sqlite3.connect(str(config.database_path)) as conn:
                conn.execute(
                    """UPDATE player_sessions SET leave_at = ?
                       WHERE server_name = ? AND leave_at IS NULL""",
                    (datetime.now(timezone.utc).isoformat(), server_name),
                )
        except Exception as e:
            logger.error("close_all_sessions failed for %s: %s", server_name, e)

    def get_playtime(self, server_name: str, from_dt: datetime, to_dt: datetime) -> list:
        """Top 10 players by total playtime (seconds). NULL leave_at contributes 0."""
        sql = """
            SELECT username,
                   SUM(CASE
                       WHEN leave_at IS NOT NULL
                       THEN CAST((julianday(leave_at) - julianday(join_at)) * 86400 AS INTEGER)
                       ELSE 0
                   END) AS total_seconds
            FROM player_sessions
            WHERE server_name = ?
              AND join_at >= ? AND join_at <= ?
            GROUP BY username
            ORDER BY total_seconds DESC
            LIMIT 10
        """
        try:
            with sqlite3.connect(str(config.database_path)) as conn:
                rows = conn.execute(
                    sql,
                    (server_name, from_dt.isoformat(), to_dt.isoformat())
                ).fetchall()
            return [{"username": r[0], "total_seconds": r[1]} for r in rows]
        except Exception as e:
            logger.error("get_playtime failed: %s", e)
            return []

    def get_heatmap(self, server_name: str, from_dt: datetime, to_dt: datetime) -> list:
        """7x24 heatmap cells. Returns list of 168 dicts with dow, hour, avg."""
        sql = """
            WITH per_day AS (
                SELECT
                    strftime('%w', join_at) AS dow,
                    strftime('%H', join_at) AS hour,
                    date(join_at)           AS day,
                    COUNT(*)                AS cnt
                FROM player_sessions
                WHERE server_name = ?
                  AND join_at >= ? AND join_at <= ?
                  AND leave_at IS NOT NULL
                GROUP BY dow, hour, day
            )
            SELECT dow, hour, AVG(cnt) AS avg_count
            FROM per_day
            GROUP BY dow, hour
        """
        try:
            with sqlite3.connect(str(config.database_path)) as conn:
                rows = conn.execute(
                    sql,
                    (server_name, from_dt.isoformat(), to_dt.isoformat())
                ).fetchall()
        except Exception as e:
            logger.error("get_heatmap failed: %s", e)
            rows = []

        lookup = {(r[0], r[1]): r[2] for r in rows}
        result = []
        for dow in range(7):
            for hour in range(24):
                key = (str(dow), f"{hour:02d}")
                result.append({"dow": dow, "hour": hour, "avg": lookup.get(key, 0.0)})
        return result

    def get_retention(self, server_name: str, from_dt: datetime, to_dt: datetime) -> dict:
        """7-day new player retention rate."""
        # Find players whose first-ever session starts within the date range
        first_timers_sql = """
            SELECT p.username, MIN(p.join_at) AS first_join
            FROM player_sessions p
            WHERE p.server_name = ?
              AND NOT EXISTS (
                  SELECT 1 FROM player_sessions p2
                  WHERE p2.server_name = p.server_name
                    AND p2.username = p.username
                    AND p2.join_at < ?
              )
              AND p.join_at >= ? AND p.join_at <= ?
            GROUP BY p.username
        """
        try:
            with sqlite3.connect(str(config.database_path)) as conn:
                first_timers = conn.execute(
                    first_timers_sql,
                    (server_name,
                     from_dt.isoformat(),
                     from_dt.isoformat(),
                     to_dt.isoformat())
                ).fetchall()

                if not first_timers:
                    return {"retention_pct": 0.0, "sample_size": 0}

                retained = 0
                for username, first_join in first_timers:
                    row = conn.execute(
                        """SELECT COUNT(*) FROM player_sessions
                           WHERE server_name = ? AND username = ?
                             AND join_at > ?
                             AND julianday(join_at) - julianday(?) <= 7""",
                        (server_name, username, first_join, first_join)
                    ).fetchone()
                    if row and row[0] > 0:
                        retained += 1

            pct = round(retained / len(first_timers) * 100, 1)
            return {"retention_pct": pct, "sample_size": len(first_timers)}
        except Exception as e:
            logger.error("get_retention failed: %s", e)
            return {"retention_pct": 0.0, "sample_size": 0}


player_analytics_service = PlayerAnalyticsService()
