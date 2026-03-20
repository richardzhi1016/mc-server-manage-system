import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
import pytest


@pytest.fixture
def analytics_db(tmp_path, monkeypatch):
    """Create an isolated DB with player_sessions table and patch config."""
    db = tmp_path / "test.db"
    import app.config as cfg_module
    original = cfg_module.config._config.copy()
    cfg_module.config._config["database_path"] = db
    with sqlite3.connect(str(db)) as conn:
        conn.execute("""
            CREATE TABLE player_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                server_name TEXT NOT NULL,
                username TEXT NOT NULL,
                join_at TEXT NOT NULL,
                leave_at TEXT
            )
        """)
    from app.services.player_analytics import PlayerAnalyticsService
    svc = PlayerAnalyticsService()
    yield svc, db
    cfg_module.config._config.update(original)


class TestRecordJoinLeave:
    def test_record_join_creates_session(self, analytics_db):
        svc, db = analytics_db
        svc.record_join("s1", "Steve")
        with sqlite3.connect(str(db)) as conn:
            row = conn.execute(
                "SELECT * FROM player_sessions WHERE username='Steve'"
            ).fetchone()
        assert row is not None
        assert row[4] is None  # leave_at is NULL

    def test_record_leave_closes_session(self, analytics_db):
        svc, db = analytics_db
        svc.record_join("s1", "Steve")
        svc.record_leave("s1", "Steve")
        with sqlite3.connect(str(db)) as conn:
            row = conn.execute(
                "SELECT leave_at FROM player_sessions WHERE username='Steve'"
            ).fetchone()
        assert row[0] is not None

    def test_close_all_sessions_fills_leave_at(self, analytics_db):
        svc, db = analytics_db
        svc.record_join("s1", "Alex")
        svc.record_join("s1", "Bob")
        svc.close_all_sessions("s1")
        with sqlite3.connect(str(db)) as conn:
            open_rows = conn.execute(
                "SELECT COUNT(*) FROM player_sessions "
                "WHERE server_name='s1' AND leave_at IS NULL"
            ).fetchone()[0]
        assert open_rows == 0


class TestPlaytimeQuery:
    def test_playtime_returns_nonzero_for_closed_session(self, analytics_db):
        svc, db = analytics_db
        now = datetime.now(timezone.utc)
        with sqlite3.connect(str(db)) as conn:
            conn.execute(
                "INSERT INTO player_sessions(server_name,username,join_at,leave_at) "
                "VALUES(?,?,?,?)",
                ("s1", "Steve",
                 (now - timedelta(minutes=10)).isoformat(),
                 now.isoformat())
            )
        result = svc.get_playtime("s1", now - timedelta(days=1), now)
        assert any(r["username"] == "Steve" and r["total_seconds"] > 0 for r in result)

    def test_playtime_open_session_contributes_zero(self, analytics_db):
        svc, db = analytics_db
        now = datetime.now(timezone.utc)
        with sqlite3.connect(str(db)) as conn:
            conn.execute(
                "INSERT INTO player_sessions(server_name,username,join_at,leave_at) "
                "VALUES(?,?,?,NULL)",
                ("s1", "Alex", (now - timedelta(minutes=5)).isoformat())
            )
        result = svc.get_playtime("s1", now - timedelta(days=1), now)
        alex = next((r for r in result if r["username"] == "Alex"), None)
        # If returned, must have 0 seconds (NULL leave_at → 0)
        if alex:
            assert alex["total_seconds"] == 0

    def test_playtime_date_range_filter(self, analytics_db):
        svc, db = analytics_db
        old = datetime(2020, 1, 1, tzinfo=timezone.utc)
        with sqlite3.connect(str(db)) as conn:
            conn.execute(
                "INSERT INTO player_sessions(server_name,username,join_at,leave_at) "
                "VALUES(?,?,?,?)",
                ("s1", "OldPlayer",
                 old.isoformat(),
                 (old + timedelta(minutes=5)).isoformat())
            )
        now = datetime.now(timezone.utc)
        result = svc.get_playtime("s1", now - timedelta(days=1), now)
        assert not any(r["username"] == "OldPlayer" for r in result)


class TestHeatmapQuery:
    def test_heatmap_returns_168_cells(self, analytics_db):
        svc, db = analytics_db
        now = datetime.now(timezone.utc)
        result = svc.get_heatmap("s1", now - timedelta(days=7), now)
        assert len(result) == 7 * 24

    def test_heatmap_excludes_open_sessions(self, analytics_db):
        svc, db = analytics_db
        now = datetime.now(timezone.utc)
        with sqlite3.connect(str(db)) as conn:
            # Open session should NOT count
            conn.execute(
                "INSERT INTO player_sessions(server_name,username,join_at,leave_at) "
                "VALUES(?,?,?,NULL)",
                ("s1", "OpenUser", (now - timedelta(hours=1)).isoformat())
            )
        result = svc.get_heatmap("s1", now - timedelta(days=7), now)
        # All cells should be 0 since no closed sessions
        assert all(cell["avg"] == 0.0 for cell in result)


class TestRetentionQuery:
    def test_retention_returns_required_fields(self, analytics_db):
        svc, db = analytics_db
        now = datetime.now(timezone.utc)
        result = svc.get_retention("s1", now - timedelta(days=30), now)
        assert "retention_pct" in result
        assert "sample_size" in result

    def test_retention_zero_when_no_data(self, analytics_db):
        svc, db = analytics_db
        now = datetime.now(timezone.utc)
        result = svc.get_retention("s1", now - timedelta(days=30), now)
        assert result["sample_size"] == 0
        assert result["retention_pct"] == 0.0
