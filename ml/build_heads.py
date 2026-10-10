"""Build backend/vision/heads.json: zero-shot text-prompt embeddings for each class (CLIP text tower).

    python ml/build_heads.py

If ml/probe_condition.json exists (from ml/train_probe.py) its trained weights replace the
zero-shot condition head; the prompt embeddings are kept for reference.
"""
import json
import os

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIP = os.path.join(ROOT, "ml", "models", "clip")

PROMPTS = {
    "kind": {
        "panel": ["a photo of solar panels", "a photo of a rooftop solar panel array", "a close-up photo of a solar panel",
                  "a photo of photovoltaic modules on a roof"],
        "inverter": ["a photo of a solar inverter display", "a photo of an inverter screen showing energy in kWh",
                     "a photo of a solar inverter mounted on a wall", "a photo of a small LCD screen on an electrical box"],
        "meter": ["a photo of an electricity meter", "a photo of a digital energy meter display",
                  "a photo of an electric meter with a numeric reading"],
        "screenshot": ["a screenshot of a mobile app", "a screenshot of a solar monitoring app with a chart",
                       "a phone screenshot with a list of dates and numbers"],
        "other": ["a photo of a room", "a photo of a person", "a photo of a street", "a photo of a tree", "a photo of food"],
    },
    "condition": {
        "clean": ["a photo of a clean solar panel", "a shiny clean solar panel reflecting the sky", "a spotless dark blue solar panel"],
        "dusty": ["a photo of a dusty solar panel", "a solar panel covered in dust and dirt", "a dirty solar panel with a layer of sand"],
        "bird_droppings": ["a solar panel with bird droppings on it", "white bird poop stains on a solar panel"],
        "damaged": ["a cracked solar panel", "a solar panel with broken glass", "a physically damaged solar panel"],
        "shaded": ["a solar panel partly covered by shadow", "a shaded solar panel with dark shadows on it"],
    },
}


def text_embeds(prompts):
    tok = Tokenizer.from_file(os.path.join(CLIP, "tokenizer.json"))
    sess = ort.InferenceSession(os.path.join(CLIP, "onnx", "text_model_quantized.onnx"), providers=["CPUExecutionProvider"])
    out = []
    for p in prompts:                                   # one at a time: no padding, so pooling hits the real EOS token
        ids = np.array([tok.encode(p).ids], dtype=np.int64)
        e = sess.run(["text_embeds"], {"input_ids": ids})[0][0]
        out.append(e / np.linalg.norm(e))
    return np.stack(out)


def fetch_model():
    """Download CLIP ONNX + tokenizer once (the vision Docker image copies the vision tower)."""
    from huggingface_hub import hf_hub_download
    for f in ["onnx/vision_model_quantized.onnx", "onnx/text_model_quantized.onnx", "tokenizer.json"]:
        hf_hub_download("Xenova/clip-vit-base-patch32", f, local_dir=CLIP)


def main():
    fetch_model()
    heads = {}
    for head, classes in PROMPTS.items():
        rows = []
        for cls, prompts in classes.items():
            m = text_embeds(prompts).mean(axis=0)       # prompt ensemble
            rows.append((m / np.linalg.norm(m)).round(6).tolist())
        heads[head] = {"classes": list(classes), "text_embeds": rows, "weights": None, "bias": None, "method": "zero-shot CLIP"}
    probe = os.path.join(ROOT, "ml", "probe_condition.json")
    if os.path.exists(probe):
        with open(probe, encoding="utf-8") as fh:
            heads["condition"].update(json.load(fh))
    out = os.path.join(ROOT, "backend", "vision", "heads.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(heads, fh)
    tok = Tokenizer.from_file(os.path.join(CLIP, "tokenizer.json"))
    print("tokens for 'a dusty solar panel':", tok.encode("a dusty solar panel").ids)
    print("wrote", out, {h: v["method"] for h, v in heads.items()})


if __name__ == "__main__":
    main()
