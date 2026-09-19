from fastapi import APIRouter, HTTPException

from schemas.bsky import (
    BskyFollowsPostRequest,
    BskyPostRequest,
    BskyPostResponse,
)
from services.bsky_service import BskyService

router = APIRouter(
    prefix="/api/v1/bsky",
    tags=["Bluesky"],
)

bsky_service = BskyService()


@router.post(
    "/post",
    response_model=BskyPostResponse,
)
async def get_random_post(req: BskyPostRequest):
    try:
        post = await bsky_service.search_posts(
            word=req.word,
            lang=req.lang,
            theme=req.theme,
            user_handle=req.user_handle,
        )

    except RuntimeError as error:
        raise HTTPException(
            status_code=503,
            detail=str(error),
        )

    if not post:
        raise HTTPException(
            status_code=404,
            detail=f'No Bluesky posts found matching "{req.word}".',
        )

    return post


@router.post(
    "/random-from-follows",
    response_model=BskyPostResponse,
)
async def get_random_post_from_follows(req: BskyFollowsPostRequest):
    try:
        post = await bsky_service.get_random_post_from_follows(
            user_handle=req.user_handle,
            lang=req.lang,
        )
    except RuntimeError as error:
        raise HTTPException(
            status_code=503,
            detail=str(error),
        )

    if not post:
        raise HTTPException(
            status_code=404,
            detail=f'No suitable posts found from accounts followed by "{req.user_handle}".',
        )

    return post