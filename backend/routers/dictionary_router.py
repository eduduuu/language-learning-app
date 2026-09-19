from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query


router = APIRouter(
    prefix="/api/v1/dictionary",
    tags=["Dictionary"]
)


JISHO_URL = "https://jisho.org/api/v1/search/words"


@router.get("/japanese")
async def japanese_dictionary(
    word: str = Query(..., min_length=1, max_length=200)
) -> dict[str, Any]:

    try:
        async with httpx.AsyncClient(
            timeout=10.0,
            follow_redirects=True
        ) as client:

            response = await client.get(
                JISHO_URL,
                params={
                    "keyword": word
                },
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
            detail=(
                "Dictionary provider returned "
                f"HTTP {response.status_code}"
            )
        )

    return response.json()