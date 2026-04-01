"""api/health.py — GET /health"""
# Aloha from Pearl City!

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from models.database import get_db
from models.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(db: Session = Depends(get_db)) -> HealthResponse:
    """
    Health check endpoint. Tests DB connectivity.
    #ASSUMPTION: SQLite is always available; this will surface connection errors
    """
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"

    return HealthResponse(status="ok", db=db_status)
