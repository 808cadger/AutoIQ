"""api/estimates.py — CRUD + pipeline trigger for estimates"""
# Aloha from Pearl City!

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from models.database import get_db
from models.estimate import Estimate
from models.schemas import EstimateCreate, EstimateListItem, EstimateResponse
from pipeline.estimate_pipeline import run as run_pipeline

router = APIRouter(prefix="/estimates", tags=["estimates"])


def _to_response(est: Estimate) -> EstimateResponse:
    """Map ORM Estimate to EstimateResponse schema."""
    vehicle: dict[str, Any] = {
        "year":    est.vehicle_year,
        "make":    est.vehicle_make,
        "model":   est.vehicle_model,
        "trim":    est.vehicle_trim,
        "mileage": est.vehicle_mileage,
    }
    return EstimateResponse(
        id=est.id,
        created_at=est.created_at,
        vehicle=vehicle,
        status=est.status,
        vision=est.vision_result,
        parts_map=est.parts_map,
        pricing=est.pricing_result,
        decision=est.decision_result,
        error_message=est.error_message,
    )


@router.post("", response_model=EstimateResponse, status_code=201)
async def create_estimate(
    body: EstimateCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> EstimateResponse:
    """
    Create an Estimate record and trigger the pipeline in the background.
    Returns immediately with status='pending'; poll GET /estimates/{id} for results.
    #ASSUMPTION: images are already uploaded via POST /images/upload
    """
    if not body.image_paths:
        raise HTTPException(status_code=422, detail="At least one image_path required")

    est = Estimate(
        vehicle_year=body.vehicle.year,
        vehicle_make=body.vehicle.make,
        vehicle_model=body.vehicle.model,
        vehicle_trim=body.vehicle.trim,
        vehicle_mileage=body.vehicle.mileage,
        image_paths=body.image_paths,
        status="pending",
    )
    db.add(est)
    db.commit()
    db.refresh(est)

    # Run pipeline in background — DB session passed separately
    background_tasks.add_task(_run_pipeline_bg, est.id)

    return _to_response(est)


async def _run_pipeline_bg(estimate_id: int) -> None:
    """Background task wrapper — creates its own DB session."""
    from models.database import SessionLocal
    db = SessionLocal()
    try:
        await run_pipeline(estimate_id, db)
    except Exception:
        pass  # pipeline already writes status='failed' to DB
    finally:
        db.close()


@router.get("/{estimate_id}", response_model=EstimateResponse)
async def get_estimate(
    estimate_id: int,
    db: Session = Depends(get_db),
) -> EstimateResponse:
    """Fetch a single estimate by ID. Returns full pipeline output when complete."""
    est: Estimate | None = db.get(Estimate, estimate_id)
    if est is None:
        raise HTTPException(status_code=404, detail=f"Estimate {estimate_id} not found")
    return _to_response(est)


@router.get("", response_model=list[EstimateListItem])
async def list_estimates(
    skip:  int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
) -> list[EstimateListItem]:
    """List estimates ordered by most recent. Max 50 per call."""
    if limit > 100:
        limit = 100
    ests = (
        db.query(Estimate)
        .order_by(Estimate.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [
        EstimateListItem(
            id=e.id,
            created_at=e.created_at,
            vehicle_year=e.vehicle_year,
            vehicle_make=e.vehicle_make,
            vehicle_model=e.vehicle_model,
            primary_part=e.primary_part,
            severity=e.severity,
            total_estimate_mid=e.total_estimate_mid,
            confidence_score=e.confidence_score,
            human_review_flag=e.human_review_flag,
            status=e.status,
        )
        for e in ests
    ]
