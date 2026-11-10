"""Stateless OCR microservice: image in, text lines (text, score, box) out.

It does NOT interpret the text. Parsing into invoice fields happens in the Quarkus backend
(deterministic parser), so nothing here can hallucinate or follow instructions found in an image.
"""
import io
import logging
import os
import threading

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

log = logging.getLogger("ocr")

MAX_BYTES = int(os.getenv("OCR_MAX_BYTES", str(10 * 1024 * 1024)))
MAX_PIXELS = int(os.getenv("OCR_MAX_PIXELS", str(40_000_000)))
LANG = os.getenv("OCR_LANG", "ro")
OCR_VERSION = os.getenv("OCR_VERSION", "PP-OCRv5")
USE_ORIENTATION = os.getenv("OCR_DOC_ORIENTATION", "true").lower() == "true"
USE_UNWARPING = os.getenv("OCR_DOC_UNWARPING", "true").lower() == "true"
CPU_THREADS = int(os.getenv("OCR_CPU_THREADS", "4"))  # keep <= the container's CPU limit
REC_BATCH = int(os.getenv("OCR_REC_BATCH", "8"))  # lines recognised per batch (library default: 1)
DET_MODEL = os.getenv("OCR_DET_MODEL", "")  # e.g. PP-OCRv5_mobile_det (lighter than the default server model)
ENABLE_MKLDNN = os.getenv("OCR_ENABLE_MKLDNN", "false").lower() == "true"
ALLOWED_FORMATS = {"JPEG", "PNG"}

Image.MAX_IMAGE_PIXELS = MAX_PIXELS

_engine = None
_lock = threading.Lock()  # one inference at a time; Paddle predictors are not thread-safe


def build_engine():
    """Create the PaddleOCR pipeline. Also called at image build time to bake the models in."""
    from paddleocr import PaddleOCR

    extra = {}
    if DET_MODEL:
        extra["text_detection_model_name"] = DET_MODEL
    return PaddleOCR(
        lang=LANG,
        ocr_version=OCR_VERSION,
        cpu_threads=CPU_THREADS,
        text_recognition_batch_size=REC_BATCH,
        **extra,
        use_doc_orientation_classify=USE_ORIENTATION,
        use_doc_unwarping=USE_UNWARPING,
        use_textline_orientation=False,
        # oneDNN (default on) crashes the detection model on CPU with Paddle 3.3.x
        # ("ConvertPirAttribute2RuntimeAttribute not support ..."); off by default.
        enable_mkldnn=ENABLE_MKLDNN,
    )


def get_engine():
    global _engine
    if _engine is None:
        with _lock:
            if _engine is None:
                _engine = build_engine()
    return _engine


app = FastAPI(title="vehicle-passport-ocr", docs_url=None, redoc_url=None)


@app.on_event("startup")
def _warm() -> None:
    get_engine()
    log.info("OCR engine ready (lang=%s, version=%s)", LANG, OCR_VERSION)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "lang": LANG, "version": OCR_VERSION}


def _to_list(value):
    return value.tolist() if hasattr(value, "tolist") else list(value)


@app.post("/ocr")
def ocr(file: UploadFile = File(...)) -> dict:
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="file too large")
    if not data:
        raise HTTPException(status_code=400, detail="empty file")

    try:
        image = Image.open(io.BytesIO(data))
        if image.format not in ALLOWED_FORMATS:
            raise HTTPException(status_code=415, detail="only JPEG and PNG are supported")
        width, height = image.size
        if width * height > MAX_PIXELS:
            raise HTTPException(status_code=413, detail="image resolution too large")
        image = ImageOps.exif_transpose(image).convert("RGB")
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(status_code=400, detail="unreadable image")

    array = np.asarray(image)[:, :, ::-1]  # RGB -> BGR (OpenCV convention used by PaddleOCR)

    with _lock:
        results = get_engine().predict(array)

    lines = []
    if results:
        payload = results[0].json
        payload = payload.get("res", payload)
        texts = payload.get("rec_texts", [])
        scores = payload.get("rec_scores", [])
        boxes = payload.get("rec_boxes", [])
        polys = payload.get("rec_polys", [])
        for i, text in enumerate(texts):
            lines.append(
                {
                    "text": text,
                    "score": float(scores[i]),
                    "box": [int(v) for v in _to_list(boxes[i])],
                    "poly": [[int(x), int(y)] for x, y in _to_list(polys[i])],
                }
            )

    return {"width": image.size[0], "height": image.size[1], "lines": lines}
