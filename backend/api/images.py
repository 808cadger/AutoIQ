"""api/images.py — POST /images/upload"""
# Aloha from Pearl City!

from fastapi import APIRouter, File, HTTPException, UploadFile

from models.schemas import ImageUploadResponse
from utils.image_store import save_upload

router = APIRouter(prefix="/images", tags=["images"])


@router.post("/upload", response_model=ImageUploadResponse)
async def upload_image(file: UploadFile = File(...)) -> ImageUploadResponse:
    """
    Upload a single damage photo. Returns filename for use in EstimateCreate.
    Validates: type (JPEG/PNG/WEBP), size (max 10 MB).
    #ASSUMPTION: caller sends one file per request; multiple photos = multiple calls
    """
    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=422, detail=f"Unsupported content type: {content_type}")

    try:
        file_bytes = await file.read()
        filename, size_kb = await save_upload(file_bytes, content_type)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image save failed: {e}")

    return ImageUploadResponse(
        filename=filename,
        path=f"/uploads/{filename}",
        size_kb=size_kb,
    )
