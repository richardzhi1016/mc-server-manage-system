import os
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
import sqlite3

from auth import hash_password

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "users.db")


class User:
    """User data class."""

    def __init__(
        self, id: str, username: str, password_hash: str, role: str, created_at: str
    ):
        self.id = id
        self.username = username
        self.password_hash = password_hash
        self.role = role
        self.created_at = created_at

    @classmethod
    def from_row(cls, row: tuple) -> "User":
        """Create User from database row."""
        return cls(
            id=row[0],
            username=row[1],
            password_hash=row[2],
            role=row[3],
            created_at=row[4],
        )

    def to_response(self) -> Dict[str, Any]:
        """Convert user to response dictionary (without password hash)."""
        return {
            "id": self.id,
            "username": self.username,
            "role": self.role,
            "created_at": self.created_at,
        }


class UserStorage:
    """User storage using SQLite database."""

    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        """Get database connection with row factory."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        """Initialize database schema."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                created_at TEXT NOT NULL
            )
        """
        )
        conn.commit()
        conn.close()

    def create_user(
        self, username: str, password: str, role: str = "user"
    ) -> Optional[User]:
        """Create a new user account."""
        user_id = str(uuid.uuid4())
        created_at = datetime.utcnow().isoformat()
        password_hash = hash_password(password)

        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO users (id, username, password_hash, role, created_at)
                VALUES (?, ?, ?, ?, ?)
            """,
                (user_id, username, password_hash, role, created_at),
            )
            conn.commit()
            return User(user_id, username, password_hash, role, created_at)
        except sqlite3.IntegrityError:
            conn.rollback()
            conn.close()
            return None
        finally:
            conn.close()

    def get_user_by_username(self, username: str) -> Optional[User]:
        """Get user by username."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, username, password_hash, role, created_at FROM users WHERE username = ?",
            (username,),
        )
        row = cursor.fetchone()
        conn.close()
        if row:
            return User.from_row(row)
        return None

    def get_user_by_id(self, user_id: str) -> Optional[User]:
        """Get user by ID."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, username, password_hash, role, created_at FROM users WHERE id = ?",
            (user_id,),
        )
        row = cursor.fetchone()
        conn.close()
        if row:
            return User.from_row(row)
        return None

    def get_all_users(self) -> List[User]:
        """Get all users."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, username, password_hash, role, created_at FROM users"
        )
        rows = cursor.fetchall()
        conn.close()
        return [User.from_row(row) for row in rows]

    def update_user(self, user_id: str, updates: Dict[str, Any]) -> Optional[User]:
        """Update user account."""
        conn = self._get_connection()
        cursor = conn.cursor()

        user = self.get_user_by_id(user_id)
        if not user:
            conn.close()
            return None

        fields = []
        values = []
        if "password" in updates:
            fields.append("password_hash = ?")
            values.append(hash_password(updates["password"]))
        if "role" in updates:
            fields.append("role = ?")
            values.append(updates["role"])

        if not fields:
            conn.close()
            return user

        values.append(user_id)
        cursor.execute(
            f"UPDATE users SET {', '.join(fields)} WHERE id = ?", tuple(values)
        )
        conn.commit()
        conn.close()

        return self.get_user_by_id(user_id)

    def delete_user(self, user_id: str) -> bool:
        """Delete user account. Returns True if deleted, False if not found."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        deleted = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return deleted

    def count_users(self) -> int:
        """Count total users."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users")
        count = cursor.fetchone()[0]
        conn.close()
        return count

    def count_admins(self) -> int:
        """Count admin users."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users WHERE role = ?", ("admin",))
        count = cursor.fetchone()[0]
        conn.close()
        return count
