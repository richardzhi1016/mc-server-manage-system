import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import app.app as flask_app_module


def test_started_at_column_exists(tmp_path):
    db_path = tmp_path / "t1.db"
    original = flask_app_module.DATABASE_PATH
    flask_app_module.DATABASE_PATH = db_path
    try:
        flask_app_module.init_database()
        with sqlite3.connect(str(db_path)) as conn:
            cols = [r[1] for r in conn.execute("PRAGMA table_info(server_instance)")]
        assert "started_at" in cols
    finally:
        flask_app_module.DATABASE_PATH = original


def test_discord_bot_config_table(tmp_path):
    db_path = tmp_path / "t2.db"
    original = flask_app_module.DATABASE_PATH
    flask_app_module.DATABASE_PATH = db_path
    try:
        flask_app_module.init_database()
        with sqlite3.connect(str(db_path)) as conn:
            conn.execute("INSERT INTO discord_bot_config(id,token,channel_id) VALUES(1,'tok','123')")
            row = conn.execute("SELECT token FROM discord_bot_config WHERE id=1").fetchone()
        assert row[0] == "tok"
    finally:
        flask_app_module.DATABASE_PATH = original


def test_player_sessions_compound_index(tmp_path):
    db_path = tmp_path / "t3.db"
    original = flask_app_module.DATABASE_PATH
    flask_app_module.DATABASE_PATH = db_path
    try:
        flask_app_module.init_database()
        with sqlite3.connect(str(db_path)) as conn:
            indexes = [r[1] for r in conn.execute("PRAGMA index_list(player_sessions)")]
        assert "idx_player_sessions_server_user_join" in indexes
    finally:
        flask_app_module.DATABASE_PATH = original
