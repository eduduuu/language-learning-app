import json
import os
import sqlite3
from typing import Any, Dict, List, Optional


DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
DB_PATH = os.path.join(DB_DIR, "dictionary_cache.db")


class DictionaryCache:
    _instance = None

    def __init__(self):
        os.makedirs(DB_DIR, exist_ok=True)
        self._init_db()

    @classmethod
    def get_instance(cls) -> "DictionaryCache":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(DB_PATH, timeout=10.0)
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS dict_cache (
                    word TEXT PRIMARY KEY,
                    reading TEXT,
                    senses_json TEXT,
                    raw_json TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_dict_word ON dict_cache(word);"
            )

    def get(self, word: str) -> Optional[Dict[str, Any]]:
        normalized = word.strip()
        if not normalized:
            return None

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT word, reading, senses_json, raw_json FROM dict_cache WHERE word = ?",
                (normalized,)
            )
            row = cursor.fetchone()
            if not row:
                return None

            try:
                raw_data = json.loads(row[3]) if row[3] else None
            except Exception:
                raw_data = None

            try:
                senses = json.loads(row[2]) if row[2] else []
            except Exception:
                senses = []

            return {
                "word": row[0],
                "reading": row[1],
                "senses": senses,
                "raw_data": raw_data,
            }

    def get_many(self, words: List[str]) -> Dict[str, Dict[str, Any]]:
        cleaned = [w.strip() for w in words if w.strip()]
        if not cleaned:
            return {}

        results: Dict[str, Dict[str, Any]] = {}
        # Batch query in chunks of 500
        chunk_size = 500
        with self._get_connection() as conn:
            cursor = conn.cursor()
            for i in range(0, len(cleaned), chunk_size):
                chunk = cleaned[i : i + chunk_size]
                placeholders = ",".join("?" * len(chunk))
                cursor.execute(
                    f"SELECT word, reading, senses_json, raw_json FROM dict_cache WHERE word IN ({placeholders})",
                    chunk
                )
                for row in cursor.fetchall():
                    try:
                        raw_data = json.loads(row[3]) if row[3] else None
                    except Exception:
                        raw_data = None

                    try:
                        senses = json.loads(row[2]) if row[2] else []
                    except Exception:
                        senses = []

                    results[row[0]] = {
                        "word": row[0],
                        "reading": row[1],
                        "senses": senses,
                        "raw_data": raw_data,
                    }

        return results

    def set(
        self,
        word: str,
        reading: Optional[str],
        senses: List[Any],
        raw_data: Optional[Dict[str, Any]] = None
    ):
        normalized = word.strip()
        if not normalized:
            return

        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO dict_cache (word, reading, senses_json, raw_json)
                VALUES (?, ?, ?, ?);
                """,
                (
                    normalized,
                    reading or "",
                    json.dumps(senses, ensure_ascii=False),
                    json.dumps(raw_data, ensure_ascii=False) if raw_data else None,
                )
            )

    def set_many(self, entries: List[Dict[str, Any]]):
        if not entries:
            return

        rows = []
        for e in entries:
            word = e.get("word", "").strip()
            if not word:
                continue
            reading = e.get("reading", "") or ""
            senses = e.get("senses", [])
            raw_data = e.get("raw_data")

            rows.append((
                word,
                reading,
                json.dumps(senses, ensure_ascii=False),
                json.dumps(raw_data, ensure_ascii=False) if raw_data else None,
            ))

        if not rows:
            return

        with self._get_connection() as conn:
            conn.executemany(
                """
                INSERT OR REPLACE INTO dict_cache (word, reading, senses_json, raw_json)
                VALUES (?, ?, ?, ?);
                """,
                rows
            )
