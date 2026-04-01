"""models/estimate.py — Auto IQ Estimate ORM model"""
# Aloha from Pearl City!

import json
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, Text, DateTime
from sqlalchemy.types import TypeDecorator
from models.database import Base


class JSONColumn(TypeDecorator):
    """Stores Python dicts/lists as JSON text in SQLite."""
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            return json.dumps(value)
        return None

    def process_result_value(self, value, dialect):
        if value is not None:
            return json.loads(value)
        return None


class Estimate(Base):
    __tablename__ = "estimates"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Vehicle info
    vehicle_year    = Column(String(8),  nullable=True)
    vehicle_make    = Column(String(64), nullable=True)
    vehicle_model   = Column(String(64), nullable=True)
    vehicle_trim    = Column(String(64), nullable=True)
    vehicle_mileage = Column(String(16), nullable=True)

    # Image references — filenames stored in IMAGE_UPLOAD_DIR
    image_paths = Column(JSONColumn, nullable=True)  # list[str]

    # Agent pipeline outputs (full JSON blobs)
    vision_result   = Column(JSONColumn, nullable=True)
    parts_map       = Column(JSONColumn, nullable=True)
    pricing_result  = Column(JSONColumn, nullable=True)
    decision_result = Column(JSONColumn, nullable=True)

    # Decision summary fields (indexed for fast queries)
    confidence_score   = Column(Float,   nullable=True)
    human_review_flag  = Column(Boolean, nullable=True, default=False)
    severity           = Column(String(16), nullable=True)
    primary_part       = Column(String(128), nullable=True)
    total_estimate_mid = Column(Float, nullable=True)

    # Status: pending | complete | failed
    status = Column(String(16), default="pending", nullable=False)
    error_message = Column(Text, nullable=True)
