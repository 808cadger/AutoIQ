"""utils/image_store.py — save/load images, validate type/size"""
# Aloha from Pearl City!

import io
import os
import uuid
from pathlib import Path

from PIL import Image

# #ASSUMPTION: IMAGE_UPLOAD_DIR is writable; created on startup if missing
UPLOAD_DIR     = Path(os.getenv("IMAGE_UPLOAD_DIR", "./uploads"))
MAX_SIZE_BYTES = int(os.getenv("MAX_IMAGE_SIZE_MB", "10")) * 1024 * 1024
ALLOWED_TYPES  = {"image/jpeg", "image/png", "image/webp"}
MAX_DIMENSION  = 4096  # pixels — resize if larger to save Claude tokens


def ensure_upload_dir() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


async def save_upload(file_bytes: bytes, content_type: str) -> tuple[str, float]:
    """
    Validate, optionally resize, and save an uploaded image.
    Returns (filename, size_kb).
    #ASSUMPTION: PIL is available and can decode the image
    """
    # Validate content type
    if content_type not in ALLOWED_TYPES:
        raise ValueError(f"Unsupported image type: {content_type}. Allowed: {ALLOWED_TYPES}")

    # Validate size
    if len(file_bytes) > MAX_SIZE_BYTES:
        raise ValueError(f"Image too large: {len(file_bytes) / 1024 / 1024:.1f} MB (max {MAX_SIZE_BYTES // 1024 // 1024} MB)")

    # Open and optionally resize
    img = Image.open(io.BytesIO(file_bytes))
    if max(img.size) > MAX_DIMENSION:
        img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)

    # Convert RGBA → RGB for JPEG compatibility
    if img.mode in ("RGBA", "P") and content_type == "image/jpeg":
        img = img.convert("RGB")

    # Determine extension
    ext_map = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
    ext      = ext_map.get(content_type, ".jpg")
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = UPLOAD_DIR / filename

    # Save
    save_kwargs: dict = {}
    if content_type == "image/jpeg":
        save_kwargs = {"format": "JPEG", "quality": 88, "optimize": True}
    elif content_type == "image/png":
        save_kwargs = {"format": "PNG", "optimize": True}
    elif content_type == "image/webp":
        save_kwargs = {"format": "WEBP", "quality": 88}

    img.save(str(filepath), **save_kwargs)
    size_kb = filepath.stat().st_size / 1024

    return filename, round(size_kb, 1)


def load_image_base64(filename: str) -> tuple[str, str]:
    """
    Load a saved image and return (base64_data, media_type).
    #ASSUMPTION: filename is safe (UUID hex + extension, no path traversal)
    """
    import base64
    safe_name = Path(filename).name  # strip any path components
    filepath  = UPLOAD_DIR / safe_name

    if not filepath.exists():
        raise FileNotFoundError(f"Image not found: {safe_name}")

    ext_to_mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                   ".png": "image/png",  ".webp": "image/webp"}
    suffix     = filepath.suffix.lower()
    media_type = ext_to_mime.get(suffix, "image/jpeg")

    data = filepath.read_bytes()
    return base64.b64encode(data).decode(), media_type
