"""Photo classifier on CLIP ViT-B/32 (OpenAI, MIT licence; ONNX export by Xenova).

Two heads over the same 512-d image embedding:
  kind:      panel / inverter / meter / screenshot / other   (routes the evidence)
  condition: clean / dusty / bird_droppings / damaged / shaded (only for panel photos)

Each head is either zero-shot (cosine similarity to text-prompt embeddings) or, when
`heads.json` holds trained weights, a linear probe on the same embedding. Pure numpy +
onnxruntime: no PyTorch at runtime.
"""
import io
import json
import os

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps

HERE = os.path.dirname(__file__)
_LOCAL = os.path.join(HERE, "..", "..", "ml", "models", "clip", "onnx", "vision_model_quantized.onnx")   # dev/tests
MODEL = os.environ.get("CLIP_VISION_ONNX") or next(
    (p for p in (os.path.join(HERE, "models", "vision_model_quantized.onnx"), _LOCAL) if os.path.exists(p)), _LOCAL)
HEADS = os.path.join(HERE, "heads.json")
MEAN = np.array([0.48145466, 0.4578275, 0.40821073], dtype=np.float32)
STD = np.array([0.26862954, 0.26130258, 0.27577711], dtype=np.float32)

_session = None
_heads = None


def _load():
    global _session, _heads
    if _session is None:
        _session = ort.InferenceSession(MODEL, providers=["CPUExecutionProvider"])
        with open(HEADS, encoding="utf-8") as fh:
            _heads = json.load(fh)
    return _session, _heads


def preprocess(img):
    """CLIP preprocessing: shortest side 224 (bicubic), centre crop 224, scale, normalise, CHW."""
    img = ImageOps.exif_transpose(img).convert("RGB")
    w, h = img.size
    s = 224 / min(w, h)
    img = img.resize((max(224, round(w * s)), max(224, round(h * s))), Image.BICUBIC)
    w, h = img.size
    left, top = (w - 224) // 2, (h - 224) // 2
    img = img.crop((left, top, left + 224, top + 224))
    x = (np.asarray(img, dtype=np.float32) / 255.0 - MEAN) / STD
    return x.transpose(2, 0, 1)


def embed(images):
    """L2-normalised 512-d embeddings for a list of PIL images."""
    sess, _ = _load()
    batch = np.stack([preprocess(i) for i in images])
    e = sess.run(["image_embeds"], {"pixel_values": batch})[0]
    return e / np.linalg.norm(e, axis=1, keepdims=True)


def _softmax(z):
    z = z - z.max()
    p = np.exp(z)
    return p / p.sum()


def head_probs(e, head):
    """Probabilities for one head: linear probe if trained, else zero-shot (logit scale 100)."""
    if head.get("weights") is not None:
        z = np.asarray(head["weights"], dtype=np.float32) @ e + np.asarray(head["bias"], dtype=np.float32)
    else:
        z = 100.0 * (np.asarray(head["text_embeds"], dtype=np.float32) @ e)
    return dict(zip(head["classes"], (round(float(p), 4) for p in _softmax(z))))


def classify_bytes(data):
    _, heads = _load()
    e = embed([Image.open(io.BytesIO(data))])[0]
    kind = head_probs(e, heads["kind"])
    top_kind = max(kind, key=kind.get)
    out = {"kind": top_kind, "kind_probs": kind, "kind_method": heads["kind"]["method"]}
    if top_kind == "panel":
        cond = head_probs(e, heads["condition"])
        out.update(condition=max(cond, key=cond.get), condition_probs=cond, condition_method=heads["condition"]["method"])
    return out
