import sqlite3
import os
from pathlib import Path

DB_PATH = os.environ.get("DEVIN_DB_PATH", str(Path(__file__).resolve().parent.parent / "devin.db"))


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS devin_analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            github_url TEXT NOT NULL,
            issue_id INTEGER NOT NULL,
            session_id TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            plan TEXT,
            confidence_score INTEGER,
            devin_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(github_url, issue_id)
        )
    """)
    conn.commit()

    # Add fix-tracking columns (idempotent for existing databases)
    for col, col_type in [
        ("fix_status", "TEXT"),
        ("fix_session_id", "TEXT"),
        ("fix_devin_url", "TEXT"),
        ("pr_url", "TEXT"),
    ]:
        try:
            conn.execute(f"ALTER TABLE devin_analyses ADD COLUMN {col} {col_type}")
            conn.commit()
        except Exception:
            pass  # Column already exists

    conn.close()


def get_analysis(github_url, issue_id):
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM devin_analyses WHERE github_url = ? AND issue_id = ?",
        (github_url, issue_id),
    ).fetchone()
    conn.close()
    if row is None:
        return None
    return dict(row)


def upsert_analysis(github_url, issue_id, **kwargs):
    conn = get_connection()
    existing = conn.execute(
        "SELECT id FROM devin_analyses WHERE github_url = ? AND issue_id = ?",
        (github_url, issue_id),
    ).fetchone()

    if existing:
        update_fields = ", ".join(f"{k} = ?" for k in kwargs)
        values = list(kwargs.values()) + [github_url, issue_id]
        conn.execute(
            f"UPDATE devin_analyses SET {update_fields}, updated_at = CURRENT_TIMESTAMP "
            f"WHERE github_url = ? AND issue_id = ?",
            values,
        )
    else:
        fields = ["github_url", "issue_id"] + list(kwargs.keys())
        placeholders = ", ".join("?" for _ in fields)
        col_names = ", ".join(fields)
        values = [github_url, issue_id] + list(kwargs.values())
        conn.execute(
            f"INSERT INTO devin_analyses ({col_names}) VALUES ({placeholders})",
            values,
        )

    conn.commit()
    conn.close()


def update_analysis(github_url, issue_id, **kwargs):
    conn = get_connection()
    update_fields = ", ".join(f"{k} = ?" for k in kwargs)
    values = list(kwargs.values()) + [github_url, issue_id]
    conn.execute(
        f"UPDATE devin_analyses SET {update_fields}, updated_at = CURRENT_TIMESTAMP "
        f"WHERE github_url = ? AND issue_id = ?",
        values,
    )
    conn.commit()
    conn.close()


def delete_analysis(github_url, issue_id):
    conn = get_connection()
    conn.execute(
        "DELETE FROM devin_analyses WHERE github_url = ? AND issue_id = ?",
        (github_url, issue_id),
    )
    conn.commit()
    conn.close()
