import json
import io
import os
import tempfile
import zipfile
import pytest
from app.services.mod_manager import ModManager


@pytest.fixture
def temp_server_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        mods_dir = os.path.join(tmpdir, "mods")
        os.makedirs(mods_dir)
        yield tmpdir


def _create_fake_mod_jar(mods_dir: str, filename: str, mod_json: dict | None = None) -> str:
    """Create a fake JAR (zip) with optional fabric.mod.json."""
    jar_path = os.path.join(mods_dir, filename)
    with zipfile.ZipFile(jar_path, "w") as zf:
        if mod_json:
            zf.writestr("fabric.mod.json", json.dumps(mod_json))
    return jar_path


class TestScanInstalledMods:
    def test_scan_empty_mods_dir(self, temp_server_dir):
        mgr = ModManager()
        result = mgr.scan_installed_mods(temp_server_dir)
        assert result == []

    def test_scan_fabric_mod_jar(self, temp_server_dir):
        mods_dir = os.path.join(temp_server_dir, "mods")
        _create_fake_mod_jar(mods_dir, "sodium-1.0.jar", {
            "id": "sodium",
            "name": "Sodium",
            "version": "1.0.0",
            "description": "Rendering engine",
            "authors": ["JellySquid"],
        })
        mgr = ModManager()
        result = mgr.scan_installed_mods(temp_server_dir)

        assert len(result) == 1
        mod = result[0]
        assert mod["filename"] == "sodium-1.0.jar"
        assert mod["mod_id"] == "sodium"
        assert mod["name"] == "Sodium"
        assert mod["enabled"] is True

    def test_scan_disabled_mod(self, temp_server_dir):
        mods_dir = os.path.join(temp_server_dir, "mods")
        _create_fake_mod_jar(mods_dir, "sodium-1.0.jar.disabled", {
            "id": "sodium",
            "name": "Sodium",
            "version": "1.0.0",
        })
        mgr = ModManager()
        result = mgr.scan_installed_mods(temp_server_dir)

        assert len(result) == 1
        assert result[0]["enabled"] is False
        assert result[0]["filename"] == "sodium-1.0.jar.disabled"

    def test_scan_non_fabric_jar(self, temp_server_dir):
        mods_dir = os.path.join(temp_server_dir, "mods")
        _create_fake_mod_jar(mods_dir, "unknown-mod.jar")  # no fabric.mod.json
        mgr = ModManager()
        result = mgr.scan_installed_mods(temp_server_dir)

        assert len(result) == 1
        mod = result[0]
        assert mod["mod_id"] is None
        assert mod["name"] == "unknown-mod.jar"  # fallback to filename

    def test_scan_includes_metadata_project_id(self, temp_server_dir):
        mods_dir = os.path.join(temp_server_dir, "mods")
        _create_fake_mod_jar(mods_dir, "sodium-1.0.jar", {"id": "sodium", "name": "Sodium", "version": "1.0.0"})
        # Write mods_metadata.json
        metadata = {"sodium-1.0.jar": {"modrinth_project_id": "AANobbMI", "modrinth_version_id": "v1"}}
        with open(os.path.join(mods_dir, "mods_metadata.json"), "w") as f:
            json.dump(metadata, f)

        mgr = ModManager()
        result = mgr.scan_installed_mods(temp_server_dir)
        assert result[0]["modrinth_project_id"] == "AANobbMI"


class TestToggleMod:
    def test_disable_mod(self, temp_server_dir):
        mods_dir = os.path.join(temp_server_dir, "mods")
        _create_fake_mod_jar(mods_dir, "sodium.jar", {"id": "sodium", "name": "Sodium", "version": "1.0"})

        mgr = ModManager()
        new_name = mgr.toggle_mod(temp_server_dir, "sodium.jar")

        assert new_name == "sodium.jar.disabled"
        assert os.path.exists(os.path.join(mods_dir, "sodium.jar.disabled"))
        assert not os.path.exists(os.path.join(mods_dir, "sodium.jar"))

    def test_enable_mod(self, temp_server_dir):
        mods_dir = os.path.join(temp_server_dir, "mods")
        _create_fake_mod_jar(mods_dir, "sodium.jar.disabled", {"id": "sodium", "name": "Sodium", "version": "1.0"})

        mgr = ModManager()
        new_name = mgr.toggle_mod(temp_server_dir, "sodium.jar.disabled")

        assert new_name == "sodium.jar"
        assert os.path.exists(os.path.join(mods_dir, "sodium.jar"))

    def test_toggle_updates_metadata(self, temp_server_dir):
        mods_dir = os.path.join(temp_server_dir, "mods")
        _create_fake_mod_jar(mods_dir, "sodium.jar")
        metadata = {"sodium.jar": {"modrinth_project_id": "AANobbMI"}}
        meta_path = os.path.join(mods_dir, "mods_metadata.json")
        with open(meta_path, "w") as f:
            json.dump(metadata, f)

        mgr = ModManager()
        mgr.toggle_mod(temp_server_dir, "sodium.jar")

        with open(meta_path) as f:
            updated = json.load(f)
        assert "sodium.jar.disabled" in updated
        assert "sodium.jar" not in updated


class TestDeleteMod:
    def test_delete_removes_file(self, temp_server_dir):
        mods_dir = os.path.join(temp_server_dir, "mods")
        jar_path = _create_fake_mod_jar(mods_dir, "sodium.jar")

        mgr = ModManager()
        mgr.delete_mod(temp_server_dir, "sodium.jar")

        assert not os.path.exists(jar_path)

    def test_delete_removes_metadata_entry(self, temp_server_dir):
        mods_dir = os.path.join(temp_server_dir, "mods")
        _create_fake_mod_jar(mods_dir, "sodium.jar")
        metadata = {"sodium.jar": {"modrinth_project_id": "AANobbMI"}, "other.jar": {"modrinth_project_id": "XYZ"}}
        meta_path = os.path.join(mods_dir, "mods_metadata.json")
        with open(meta_path, "w") as f:
            json.dump(metadata, f)

        mgr = ModManager()
        mgr.delete_mod(temp_server_dir, "sodium.jar")

        with open(meta_path) as f:
            updated = json.load(f)
        assert "sodium.jar" not in updated
        assert "other.jar" in updated

    def test_delete_nonexistent_raises(self, temp_server_dir):
        mgr = ModManager()
        with pytest.raises(FileNotFoundError):
            mgr.delete_mod(temp_server_dir, "nofile.jar")


class TestInstallMod:
    def test_install_saves_file_and_metadata(self, temp_server_dir):
        mods_dir = os.path.join(temp_server_dir, "mods")
        # Create a fake jar as bytes
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("fabric.mod.json", '{"id":"test","name":"Test","version":"1.0"}')
        jar_bytes = buf.getvalue()

        mgr = ModManager()
        mgr.install_mod_from_bytes(
            server_dir=temp_server_dir,
            filename="test-mod.jar",
            data=jar_bytes,
            modrinth_project_id="PROJ1",
            modrinth_version_id="VER1",
        )

        assert os.path.exists(os.path.join(mods_dir, "test-mod.jar"))
        meta_path = os.path.join(mods_dir, "mods_metadata.json")
        with open(meta_path) as f:
            meta = json.load(f)
        assert meta["test-mod.jar"]["modrinth_project_id"] == "PROJ1"
