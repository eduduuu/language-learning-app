from fastapi import APIRouter, Header, HTTPException, status
from schemas.analytics import UserSettingsResponse, UserSettingsUpdate, AnalyticsOverviewResponse
from repositories.analytics_repository import AnalyticsRepository

router = APIRouter(prefix="/api/v1", tags=["Analytics & User Settings"])

@router.get("/settings", response_model=UserSettingsResponse)
async def get_settings(x_user_id: str = Header(...)):
    return AnalyticsRepository.get_user_settings(x_user_id)

@router.patch("/settings", response_model=UserSettingsResponse)
async def update_settings(
    req: UserSettingsUpdate,
    x_user_id: str = Header(...)
):
    if req.max_new_cards_per_day is None:
        raise HTTPException(status_code=400, detail="No setting fields provided for update.")
    return AnalyticsRepository.update_user_settings(x_user_id, req.max_new_cards_per_day)

@router.get("/analytics/overview", response_model=AnalyticsOverviewResponse)
async def get_analytics_overview(x_user_id: str = Header(...)):
    return AnalyticsRepository.get_analytics_metrics(x_user_id)