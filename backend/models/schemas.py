"""models/schemas.py — Auto IQ Pydantic request/response schemas"""
# Aloha from Pearl City!

from __future__ import annotations
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field, field_validator


# ── Vehicle ───────────────────────────────────────────────────

class VehicleIn(BaseModel):
    year:    str = Field(..., min_length=4, max_length=4, description="4-digit model year")
    make:    str = Field(..., min_length=1, max_length=64)
    model:   str = Field(..., min_length=1, max_length=64)
    trim:    Optional[str] = Field(None, max_length=64)
    mileage: Optional[str] = Field(None, max_length=16)

    @field_validator("year")
    @classmethod
    def year_must_be_numeric(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("year must be numeric")
        yr = int(v)
        if not (1970 <= yr <= 2030):
            raise ValueError("year out of valid range")
        return v


# ── Estimate request/response ─────────────────────────────────

class EstimateCreate(BaseModel):
    vehicle:     VehicleIn
    image_paths: list[str] = Field(default_factory=list, max_length=2)


class VisionResult(BaseModel):
    primary_part:            str
    damage_type:             str
    severity:                str
    secondary_damage:        list[str] = []
    prior_repair_indicators: bool = False
    photo_quality:           str = "good"
    raw_description:         str = ""


class PartLineItem(BaseModel):
    part_name:     str
    repair_action: str
    parts_source:  str
    quantity:      int = 1
    notes:         Optional[str] = None


class PriceRange(BaseModel):
    low:  float
    mid:  float
    high: float


class LaborDetail(BaseModel):
    hours: float
    rate:  float
    low:   float
    mid:   float
    high:  float


class PricingResult(BaseModel):
    parts:      PriceRange
    labor:      LaborDetail
    paint:      PriceRange
    total:      PriceRange
    line_items: list[dict[str, Any]] = []


class DecisionResult(BaseModel):
    confidence_score:  float = Field(..., ge=0, le=100)
    human_review_flag: bool
    review_reasons:    list[str] = []
    executive_summary: str
    pipeline_warnings: list[str] = []
    disclaimer:        str = "Preliminary estimate only. Visible damage assessed from photos."


class EstimateResponse(BaseModel):
    id:             int
    created_at:     datetime
    vehicle:        dict[str, Any]
    status:         str
    vision:         Optional[dict[str, Any]]  = None
    parts_map:      Optional[list[Any]]       = None
    pricing:        Optional[dict[str, Any]]  = None
    decision:       Optional[dict[str, Any]]  = None
    error_message:  Optional[str]             = None

    model_config = {"from_attributes": True}


class EstimateListItem(BaseModel):
    id:                int
    created_at:        datetime
    vehicle_year:      Optional[str]
    vehicle_make:      Optional[str]
    vehicle_model:     Optional[str]
    primary_part:      Optional[str]
    severity:          Optional[str]
    total_estimate_mid: Optional[float]
    confidence_score:  Optional[float]
    human_review_flag: Optional[bool]
    status:            str

    model_config = {"from_attributes": True}


# ── Image upload ──────────────────────────────────────────────

class ImageUploadResponse(BaseModel):
    filename: str
    path:     str
    size_kb:  float


# ── Health ────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status:  str
    version: str = "1.0.0"
    db:      str
