import asyncio
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from core.dictionary_cache import DictionaryCache


router = APIRouter(
    prefix="/api/v1/dictionary",
    tags=["Dictionary"]
)


JISHO_URL = "https://jisho.org/api/v1/search/words"

# Shared persistent HTTP client with connection pooling
_client: Optional[httpx.AsyncClient] = None


def get_http_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=5.0),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
            follow_redirects=True,
        )
    return _client


def _parse_jisho_entry(item: Dict[str, Any], query_word: str) -> Dict[str, Any]:
    japanese_list = item.get("japanese") or []
    first_jp = japanese_list[0] if japanese_list else {}
    word = first_jp.get("word") or query_word
    reading = first_jp.get("reading") or ""

    senses_list = item.get("senses") or []
    senses = []
    for s in senses_list[:5]:
        senses.append({
            "englishDefinitions": s.get("english_definitions") or [],
            "partsOfSpeech": s.get("parts_of_speech") or [],
        })

    return {
        "word": word,
        "reading": reading,
        "senses": senses,
    }


class BatchDictionaryRequest(BaseModel):
    words: List[str] = Field(..., max_length=500)


@router.get("/japanese")
async def japanese_dictionary(
    word: str = Query(..., min_length=1, max_length=200)
) -> dict[str, Any]:
    cache = DictionaryCache.get_instance()
    cached = cache.get(word)

    if cached:
        # If raw_data is available, return it directly
        if cached.get("raw_data"):
            return cached["raw_data"]

        # Otherwise reconstruct Jisho-compatible payload
        return {
            "data": [
                {
                    "japanese": [
                        {
                            "word": cached.get("word", word),
                            "reading": cached.get("reading", "")
                        }
                    ],
                    "senses": [
                        {
                            "english_definitions": s.get("englishDefinitions", []),
                            "parts_of_speech": s.get("partsOfSpeech", [])
                        }
                        for s in cached.get("senses", [])
                    ]
                }
            ]
        }

    client = get_http_client()
    try:
        response = await client.get(
            JISHO_URL,
            params={"keyword": word},
            headers={
                "Accept": "application/json",
                "User-Agent": "ContextReader/1.0"
            }
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Dictionary request timed out."
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Dictionary request failed: {exc}"
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Dictionary provider returned HTTP {response.status_code}"
        )

    json_data = response.json()

    # Save into persistent cache
    data_list = json_data.get("data") or []
    if data_list:
        parsed = _parse_jisho_entry(data_list[0], word)
        cache.set(
            word=word,
            reading=parsed["reading"],
            senses=parsed["senses"],
            raw_data=json_data
        )
    else:
        cache.set(
            word=word,
            reading="",
            senses=[],
            raw_data=json_data
        )

    return json_data


@router.post("/japanese/batch")
async def batch_japanese_dictionary(
    request: BatchDictionaryRequest
) -> Dict[str, Any]:
    """
    High-performance batch dictionary lookup:
    1. Checks persistent SQLite cache first (resolves cached words in <1ms).
    2. Fetches uncached words concurrently using an HTTP connection pool.
    3. Persists fetched words to SQLite for instant future lookups.
    """
    raw_words = request.words
    cleaned_words = list(dict.fromkeys(w.strip() for w in raw_words if w and w.strip()))

    if not cleaned_words:
        return {"results": {}}

    cache = DictionaryCache.get_instance()
    cached_map = cache.get_many(cleaned_words)

    results: Dict[str, List[Dict[str, Any]]] = {}
    missing_words: List[str] = []

    for word in cleaned_words:
        if word in cached_map:
            c = cached_map[word]
            results[word] = [
                {
                    "word": c.get("word", word),
                    "reading": c.get("reading", ""),
                    "senses": c.get("senses", [])
                }
            ] if c.get("reading") or c.get("senses") else []
        else:
            missing_words.push(word) if hasattr(missing_words, "push") else missing_words.append(word)

    if missing_words:
        client = get_http_client()
        semaphore = asyncio.Semaphore(10)

        async def fetch_word(w: str) -> tuple[str, Optional[Dict[str, Any]]]:
            async with semaphore:
                try:
                    resp = await client.get(
                        JISHO_URL,
                        params={"keyword": w},
                        headers={
                            "Accept": "application/json",
                            "User-Agent": "ContextReader/1.0"
                        }
                    )
                    if resp.status_code == 200:
                        return w, resp.json()
                except Exception:
                    pass
                return w, None

        tasks = [fetch_word(w) for w in missing_words]
        fetched_results = await asyncio.gather(*tasks)

        entries_to_cache: List[Dict[str, Any]] = []

        for word, raw_json in fetched_results:
            if not raw_json:
                results[word] = []
                continue

            data_list = raw_json.get("data") or []
            if not data_list:
                results[word] = []
                entries_to_cache.append({
                    "word": word,
                    "reading": "",
                    "senses": [],
                    "raw_data": raw_json
                })
                continue

            parsed_entries: List[Dict[str, Any]] = []
            for item in data_list[:3]:
                parsed_entries.append(_parse_jisho_entry(item, word))

            results[word] = parsed_entries

            # Cache the primary entry
            primary = parsed_entries[0]
            entries_to_cache.append({
                "word": word,
                "reading": primary.get("reading", ""),
                "senses": primary.get("senses", []),
                "raw_data": raw_json
            })

        if entries_to_cache:
            cache.set_many(entries_to_cache)

    return {"results": results}