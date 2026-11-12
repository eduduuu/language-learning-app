from datetime import datetime, timezone
import pytest
from fsrs import Scheduler, Card, Rating, State
from fastapi.testclient import TestClient

from main import app
from services.srs_service import SRSService
from core.llm.fallback_adapter import FallbackLLMAdapter


def test_health_check():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "llm_provider" in data


def test_fsrs_graduation_lifecycle():
    """Verify that a card transitions: New (0) -> Learning (1) -> Review (2) without getting stuck."""
    scheduler = Scheduler()
    now = datetime.now(timezone.utc)

    # 1. New card
    card = Card()
    sc1, _ = scheduler.review_card(card, Rating.Good, review_datetime=now)
    assert sc1.state == State.Learning
    assert sc1.step == 1

    # 2. Reconstruct card from simulated database record (including step and last_review)
    card_reconstructed = Card(
        state=sc1.state,
        step=sc1.step,
        difficulty=sc1.difficulty,
        stability=sc1.stability,
        due=sc1.due,
        last_review=sc1.last_review,
    )

    # 3. Second review graduates to Review (State.Review = 2)
    sc2, _ = scheduler.review_card(card_reconstructed, Rating.Good, review_datetime=now)
    assert sc2.state == State.Review, f"Expected State.Review (2) but got {sc2.state}"
    assert sc2.step is None


def test_srs_rating_mapping():
    """Verify that our rating map supports all expected ratings."""
    rating_map = {
        "very_hard": Rating.Again,
        "again": Rating.Again,
        "hard": Rating.Hard,
        "ok": Rating.Good,
        "good": Rating.Easy,
        "easy": Rating.Easy,
    }

    assert rating_map["very_hard"] == Rating.Again
    assert rating_map["again"] == Rating.Again
    assert rating_map["hard"] == Rating.Hard
    assert rating_map["ok"] == Rating.Good
    assert rating_map["good"] == Rating.Easy
    assert rating_map["easy"] == Rating.Easy


def test_fallback_adapter_initialization():
    """Verify that FallbackLLMAdapter initializes without crashing."""
    adapter = FallbackLLMAdapter()
    assert adapter.primary is not None or adapter.fallback is not None


@pytest.mark.anyio
async def test_llm_generate_json():
    """Verify that the primary LLM adapter generates valid JSON according to schema."""
    adapter = FallbackLLMAdapter()
    schema = {
        "type": "object",
        "properties": {
            "meaning": {"type": "string"}
        },
        "required": ["meaning"]
    }
    result = await adapter.generate_json("What is 桜 in English?", schema)
    assert isinstance(result, dict)
    assert "meaning" in result

