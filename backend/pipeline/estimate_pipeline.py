"""pipeline/estimate_pipeline.py — async orchestrator for the 4-agent pipeline"""
# Aloha from Pearl City!

import base64
import logging
import time
from typing import Any

from sqlalchemy.orm import Session

from agents import vision_agent, parts_map_agent, pricing_agent, decision_agent
from models.estimate import Estimate
from utils.image_store import load_image_base64

logger = logging.getLogger("autoiq.pipeline")


async def run(estimate_id: int, db: Session) -> Estimate:
    """
    Load the pending Estimate from DB, run all 4 agents sequentially,
    persist results, and return the updated Estimate.
    #ASSUMPTION: estimate row exists with status='pending' and image_paths set
    """
    est: Estimate | None = db.get(Estimate, estimate_id)
    if est is None:
        raise ValueError(f"Estimate {estimate_id} not found")

    vehicle = {
        "year":    est.vehicle_year    or "",
        "make":    est.vehicle_make    or "",
        "model":   est.vehicle_model   or "",
        "trim":    est.vehicle_trim    or "",
        "mileage": est.vehicle_mileage or "",
    }

    # Build image content blocks from saved files
    image_payloads: list[dict[str, Any]] = []
    for filename in (est.image_paths or []):
        try:
            b64, media_type = load_image_base64(filename)
            image_payloads.append({
                "type": "image",
                "source": {"type": "base64", "media_type": media_type, "data": b64},
            })
        except FileNotFoundError:
            logger.warning(f"Image not found: {filename} — skipping")

    if not image_payloads:
        _fail(est, db, "No valid images found for pipeline")
        raise ValueError("No images to process")

    t0 = time.perf_counter()
    logger.info(f"[pipeline] starting estimate_id={estimate_id}")

    try:
        # Step 1 — Vision
        logger.info(f"[pipeline] step=vision estimate_id={estimate_id}")
        vision_result = await vision_agent.run(vehicle, image_payloads)
        est.vision_result = vision_result
        db.commit()

        # Step 2 — Parts map
        logger.info(f"[pipeline] step=parts estimate_id={estimate_id}")
        parts_result = await parts_map_agent.run(vision_result, vehicle)
        est.parts_map = parts_result
        db.commit()

        # Step 3 — Pricing
        logger.info(f"[pipeline] step=pricing estimate_id={estimate_id}")
        pricing_result = await pricing_agent.run(parts_result, vehicle)
        est.pricing_result = pricing_result
        db.commit()

        # Step 4 — Decision
        logger.info(f"[pipeline] step=decision estimate_id={estimate_id}")
        decision_result = await decision_agent.run(vision_result, parts_result, pricing_result, vehicle)
        est.decision_result = decision_result
        db.commit()

        # Denormalize key fields for fast list queries
        est.confidence_score   = float(decision_result.get("confidence_score", 0))
        est.human_review_flag  = bool(decision_result.get("human_review_flag", False))
        est.severity           = str(vision_result.get("severity", ""))
        est.primary_part       = str(vision_result.get("primary_part", ""))
        est.total_estimate_mid = float((pricing_result.get("total") or {}).get("mid", 0))
        est.status             = "complete"
        db.commit()

        elapsed = round((time.perf_counter() - t0) * 1000)
        logger.info(f"[pipeline] complete estimate_id={estimate_id} elapsed_ms={elapsed}")

        return est

    except Exception as exc:
        _fail(est, db, str(exc))
        raise


def _fail(est: Estimate, db: Session, msg: str) -> None:
    """Mark estimate as failed and persist."""
    try:
        est.status        = "failed"
        est.error_message = msg[:1000]  # cap to column size
        db.commit()
    except Exception:
        db.rollback()
    logger.error(f"[pipeline] failed estimate_id={est.id} error={msg}")
