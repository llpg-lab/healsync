import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any


BACKEND_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv("HEALSYNC_DB_PATH", BACKEND_DIR / "data" / "healsync.db"))


def utc_now() -> str:
    return datetime.now().isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def to_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def from_json(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                password_salt TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS auth_sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS profiles (
                user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                gender TEXT,
                age TEXT,
                height TEXT,
                weight TEXT,
                taste TEXT NOT NULL DEFAULT '[]',
                allergies TEXT NOT NULL DEFAULT '[]',
                conditions TEXT NOT NULL DEFAULT '[]',
                fitness_goal TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS diet_suggestions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                ingredients TEXT,
                mood TEXT,
                note TEXT,
                decision TEXT,
                score INTEGER,
                request_payload TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS diet_records (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                food_identification TEXT NOT NULL DEFAULT '[]',
                analysis TEXT NOT NULL DEFAULT '{}',
                score INTEGER,
                model_used TEXT,
                image_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS diet_record_images (
                id TEXT PRIMARY KEY,
                record_id TEXT NOT NULL REFERENCES diet_records(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                image_url TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_suggestions_user_created
                ON diet_suggestions(user_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_records_user_created
                ON diet_records(user_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_record_images_record
                ON diet_record_images(record_id);
            """
        )

        with get_conn() as conn:
            try:
                conn.execute("ALTER TABLE diet_suggestions ADD COLUMN request_payload TEXT")
            except Exception:
                pass


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000)
    return digest.hex(), salt


def verify_password(password: str, stored_hash: str, salt: str) -> bool:
    candidate, _ = hash_password(password, salt)
    return hmac.compare_digest(candidate, stored_hash)


def user_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {"id": row["id"], "username": row["username"], "email": row["email"]}


def profile_row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "gender": row["gender"] or "",
        "age": row["age"] or "",
        "height": row["height"] or "",
        "weight": row["weight"] or "",
        "taste": from_json(row["taste"], []),
        "allergies": from_json(row["allergies"], []),
        "conditions": from_json(row["conditions"], []),
        "fitnessGoal": row["fitness_goal"] or "",
    }


def upsert_profile(conn: sqlite3.Connection, user_id: str, profile: dict[str, Any]) -> dict[str, Any]:
    now = utc_now()
    conn.execute(
        """
        INSERT INTO profiles (
            user_id, gender, age, height, weight, taste, allergies, conditions, fitness_goal, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            gender = excluded.gender,
            age = excluded.age,
            height = excluded.height,
            weight = excluded.weight,
            taste = excluded.taste,
            allergies = excluded.allergies,
            conditions = excluded.conditions,
            fitness_goal = excluded.fitness_goal,
            updated_at = excluded.updated_at
        """,
        (
            user_id,
            profile.get("gender", ""),
            profile.get("age", ""),
            profile.get("height", ""),
            profile.get("weight", ""),
            to_json(profile.get("taste", [])),
            to_json(profile.get("allergies", [])),
            to_json(profile.get("conditions", [])),
            profile.get("fitnessGoal", ""),
            now,
            now,
        ),
    )
    row = conn.execute("SELECT * FROM profiles WHERE user_id = ?", (user_id,)).fetchone()
    return profile_row_to_dict(row) or {}


def create_user(username: str, email: str, password: str, profile: dict[str, Any] | None = None) -> dict[str, Any]:
    now = utc_now()
    user_id = new_id()
    password_hash, salt = hash_password(password)
    token = secrets.token_urlsafe(32)
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO users (id, username, email, password_hash, password_salt, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, username, email, password_hash, salt, now, now),
        )
        conn.execute(
            "INSERT INTO auth_sessions (token, user_id, created_at) VALUES (?, ?, ?)",
            (token, user_id, now),
        )
        saved_profile = upsert_profile(conn, user_id, profile or {})
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return {"token": token, "user": user_row_to_dict(user), "profile": saved_profile}


def login_user(username_or_email: str, password: str) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ? OR email = ?",
            (username_or_email, username_or_email),
        ).fetchone()
        if row is None or not verify_password(password, row["password_hash"], row["password_salt"]):
            return None
        token = secrets.token_urlsafe(32)
        conn.execute(
            "INSERT INTO auth_sessions (token, user_id, created_at) VALUES (?, ?, ?)",
            (token, row["id"], utc_now()),
        )
        profile = conn.execute("SELECT * FROM profiles WHERE user_id = ?", (row["id"],)).fetchone()
    return {"token": token, "user": user_row_to_dict(row), "profile": profile_row_to_dict(profile)}


def get_session_user(token: str) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT users.* FROM auth_sessions
            JOIN users ON users.id = auth_sessions.user_id
            WHERE auth_sessions.token = ?
            """,
            (token,),
        ).fetchone()
        if row is None:
            return None
        profile = conn.execute("SELECT * FROM profiles WHERE user_id = ?", (row["id"],)).fetchone()
    return {"user": user_row_to_dict(row), "profile": profile_row_to_dict(profile)}


def logout_token(token: str) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM auth_sessions WHERE token = ?", (token,))


def created_on_clause(date: str | None) -> tuple[str, tuple[Any, ...]]:
    if not date:
        return "", ()
    return " AND substr(created_at, 1, 10) = ?", (date,)


def suggestion_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "ingredients": row["ingredients"] or "",
        "mood": row["mood"] or "",
        "note": row["note"] or "",
        "decision": from_json(row["decision"], None),
        "score": row["score"],
        "requestPayload": from_json(row["request_payload"], None),
        "createdAt": row["created_at"],
    }


def record_row_to_dict(row: sqlite3.Row, images: list[str] | None = None) -> dict[str, Any]:
    analysis = from_json(row["analysis"], {})
    food_identification = from_json(row["food_identification"], [])
    return {
        "id": row["id"],
        "title": f"照片分析 {row['created_at'][11:16]}",
        "score": row["score"],
        "note": "、".join(food_identification) or analysis.get("nutrition", "已完成饮食分析"),
        "createdAt": row["created_at"],
        "images": images or [],
        "result": {
            "food_identification": food_identification,
            "analysis": analysis,
            "score": row["score"],
            "timestamp": row["created_at"],
            "image_count": row["image_count"],
            "model_used": row["model_used"],
        },
    }


def create_suggestion(user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    suggestion_id = new_id()
    created_at = payload.get("createdAt") or utc_now()
    decision = payload.get("decision")
    request_payload = payload.get("requestPayload")
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO diet_suggestions (id, user_id, ingredients, mood, note, decision, score, request_payload, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                suggestion_id,
                user_id,
                payload.get("ingredients", ""),
                payload.get("mood", ""),
                payload.get("note", ""),
                to_json(decision) if decision is not None else None,
                payload.get("score"),
                to_json(request_payload) if request_payload is not None else None,
                created_at,
            ),
        )
        row = conn.execute("SELECT * FROM diet_suggestions WHERE id = ?", (suggestion_id,)).fetchone()
    return suggestion_row_to_dict(row)


def list_suggestions(user_id: str, date: str | None = None) -> list[dict[str, Any]]:
    clause, params = created_on_clause(date)
    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT * FROM diet_suggestions WHERE user_id = ?{clause} ORDER BY created_at DESC",
            (user_id, *params),
        ).fetchall()
    return [suggestion_row_to_dict(row) for row in rows]


def create_diet_record(
    user_id: str,
    food_identification: list[str],
    analysis: dict[str, Any],
    score: int,
    model_used: str,
    image_urls: list[str],
    created_at: str | None = None,
) -> dict[str, Any]:
    record_id = new_id()
    created_at = created_at or utc_now()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO diet_records (
                id, user_id, food_identification, analysis, score, model_used, image_count, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record_id,
                user_id,
                to_json(food_identification),
                to_json(analysis),
                score,
                model_used,
                len(image_urls),
                created_at,
            ),
        )
        for image_url in image_urls:
            conn.execute(
                """
                INSERT INTO diet_record_images (id, record_id, user_id, image_url, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (new_id(), record_id, user_id, image_url, created_at),
            )
        row = conn.execute("SELECT * FROM diet_records WHERE id = ?", (record_id,)).fetchone()
    return record_row_to_dict(row, image_urls)


def list_diet_records(user_id: str, date: str | None = None) -> list[dict[str, Any]]:
    clause, params = created_on_clause(date)
    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT * FROM diet_records WHERE user_id = ?{clause} ORDER BY created_at DESC",
            (user_id, *params),
        ).fetchall()
        result = []
        for row in rows:
            images = conn.execute(
                "SELECT image_url FROM diet_record_images WHERE record_id = ? ORDER BY created_at ASC",
                (row["id"],),
            ).fetchall()
            result.append(record_row_to_dict(row, [image["image_url"] for image in images]))
    return result


def calendar_summary(user_id: str) -> dict[str, Any]:
    with get_conn() as conn:
        diet_rows = conn.execute(
            """
            SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS record_count, AVG(score) AS avg_score
            FROM diet_records
            WHERE user_id = ?
            GROUP BY day
            """,
            (user_id,),
        ).fetchall()
        suggestion_rows = conn.execute(
            """
            SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS suggestion_count
            FROM diet_suggestions
            WHERE user_id = ?
            GROUP BY day
            """,
            (user_id,),
        ).fetchall()

    days: dict[str, dict[str, Any]] = {}
    for row in diet_rows:
        days[row["day"]] = {
            "date": row["day"],
            "record_count": row["record_count"],
            "suggestion_count": 0,
            "avg_score": round(row["avg_score"] or 0),
        }
    for row in suggestion_rows:
        days.setdefault(
            row["day"],
            {"date": row["day"], "record_count": 0, "suggestion_count": 0, "avg_score": None},
        )["suggestion_count"] = row["suggestion_count"]
    return {"days": sorted(days.values(), key=lambda item: item["date"], reverse=True)}
