"""main.py — Auto IQ FastAPI backend"""
# Aloha from Pearl City! 🌺

import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

load_dotenv()  # load .env before anything reads env vars

from models.database import init_db
from utils.image_store import ensure_upload_dir
from api.health import router as health_router
from api.images import router as images_router
from api.estimates import router as estimates_router

# Structured logging
logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}',
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
logger = logging.getLogger("autoiq.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    ensure_upload_dir()
    init_db()
    logger.info("Auto IQ backend started")
    yield
    # Shutdown
    logger.info("Auto IQ backend shutting down")


app = FastAPI(
    title="Auto IQ API",
    description="AI vehicle damage assessment and repair cost estimation",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow PWA origin and localhost dev
cors_origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:8080,http://localhost:3000")
cors_origins     = [o.strip() for o in cors_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded images statically
upload_dir = os.getenv("IMAGE_UPLOAD_DIR", "./uploads")
os.makedirs(upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")

# Routers
app.include_router(health_router)
app.include_router(images_router)
app.include_router(estimates_router)


@app.get("/")
async def root():
    return {"app": "Auto IQ", "version": "1.0.0", "docs": "/docs"}
