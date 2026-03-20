# tests/test_discord_bot_manager.py
import threading, time
from unittest.mock import patch, MagicMock, call
import pytest
from app.services.discord_bot import DiscordBotManager


@pytest.fixture
def manager():
    return DiscordBotManager()


class TestStartStop:
    def test_initial_state_is_stopped(self, manager):
        assert manager.get_state() == "stopped"
        assert not manager.is_running()

    def test_start_creates_process(self, manager):
        with patch("subprocess.Popen") as mock_popen:
            mock_proc = MagicMock()
            mock_proc.pid = 9999
            mock_proc.poll.return_value = None
            mock_popen.return_value = mock_proc
            with patch("builtins.open", MagicMock()):
                manager.start("tok", "chan", "secret", "http://127.0.0.1:5000")
            assert mock_popen.called
            assert manager.get_state() == "running"

    def test_stop_terminates_process(self, manager):
        with patch("subprocess.Popen") as mock_popen:
            mock_proc = MagicMock()
            mock_proc.pid = 9999
            mock_proc.poll.return_value = None
            mock_popen.return_value = mock_proc
            with patch("builtins.open", MagicMock()):
                manager.start("tok", "chan", "secret", "http://127.0.0.1:5000")
            manager.stop()
        assert manager.get_state() == "stopped"


class TestPidFile:
    def test_pid_written_on_start(self, manager, tmp_path):
        pid_file = tmp_path / "bot.pid"
        with patch("app.services.discord_bot.PID_FILE", str(pid_file)):
            with patch("subprocess.Popen") as mock_popen:
                mock_proc = MagicMock()
                mock_proc.pid = 12345
                mock_proc.poll.return_value = None
                mock_popen.return_value = mock_proc
                manager.start("tok", "chan", "secret", "http://127.0.0.1:5000")
        assert pid_file.read_text().strip() == "12345"

    def test_pid_deleted_on_stop(self, manager, tmp_path):
        pid_file = tmp_path / "bot.pid"
        pid_file.write_text("12345")
        with patch("app.services.discord_bot.PID_FILE", str(pid_file)):
            with patch("subprocess.Popen") as mock_popen:
                mock_proc = MagicMock()
                mock_proc.pid = 12345
                mock_proc.poll.return_value = None
                mock_popen.return_value = mock_proc
                manager.start("tok", "chan", "secret", "http://127.0.0.1:5000")
            manager.stop()
        assert not pid_file.exists()


class TestSendEvent:
    def test_send_event_is_nonblocking(self, manager):
        from app.services.alert_service import AlertEvent
        with patch("requests.post") as mock_post:
            mock_post.side_effect = lambda *a, **kw: time.sleep(0.5)
            manager._bot_event_port = 5050
            manager._internal_secret = "secret"
            manager._state = "running"
            t0 = time.time()
            event = AlertEvent.server_crashed("s1")
            manager.send_event(event)
            elapsed = time.time() - t0
        assert elapsed < 0.2  # non-blocking: returned immediately
