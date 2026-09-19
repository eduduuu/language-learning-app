from datetime import datetime
from pydantic import BaseModel, Field


class BskyPostRequest(BaseModel):
    word: str = Field(..., min_length=1, max_length=100)
    lang: str | None = Field(
        default="ja",
        description="BCP-47 language tag (e.g., 'ja', 'es', 'pt', 'en')",
    )
    theme: str | None = Field(
        default=None,
        description="Optional theme filter: 'movies', 'anime', 'gaming', 'books', 'tech'",
    )
    user_handle: str | None = Field(
        default=None,
        description="Optional handle to restrict search to accounts they follow",
    )


class BskyFollowsPostRequest(BaseModel):
    user_handle: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Bluesky handle (e.g. 'alice.bsky.social')",
    )
    lang: str | None = Field(
        default=None,
        description="Optional BCP-47 language tag (e.g., 'ja', 'es', 'pt', 'en')",
    )


class BskyPostResponse(BaseModel):
    uri: str
    cid: str
    text: str
    author_handle: str
    author_display_name: str | None = None
    created_at: datetime
    url: str