"""Train the panel-condition head (clean / dirty) as a linear probe on CLIP image embeddings.

    python ml/train_probe.py <dataset_dir>

<dataset_dir> holds {train,val,test}/{clean,dirty}/*.jpg, e.g. a snapshot of the Hugging Face
dataset adityashirsatrao007/solar-dust-data-combined. Writes ml/probe_condition.json, which
ml/build_heads.py folds into backend/vision/heads.json. Also scores the independent real-photo
set in ml/data/eval (Wikimedia; bird droppings count as dirty).
"""
import glob
import json
import os
import sys

import numpy as np
from PIL import Image
from sklearn.linear_model import LogisticRegression

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "backend"))
from vision.clip import embed  # noqa: E402

CLASSES = ["clean", "dirty"]


def load(files):
    out = []
    for i in range(0, len(files), 64):
        imgs = []
        for f in files[i:i + 64]:
            with Image.open(f) as im:
                imgs.append(im.copy())
        out.append(embed(imgs))
    return np.concatenate(out)


def split(root, name):
    files, y = [], []
    for c, cls in enumerate(CLASSES):
        fs = sorted(glob.glob(os.path.join(root, name, cls, "*")))
        files += fs; y += [c] * len(fs)
    return load(files), np.array(y)


def report(name, clf, X, y):
    p = clf.predict(X)
    per = {cls: f"{int((p[y == c] == c).sum())}/{int((y == c).sum())}" for c, cls in enumerate(CLASSES)}
    print(f"{name:10} accuracy {(p == y).mean():.3f}  {per}")
    return float((p == y).mean())


def main():
    root = sys.argv[1]
    Xtr, ytr = split(root, "train")
    Xva, yva = split(root, "val")
    Xte, yte = split(root, "test")
    best = max((LogisticRegression(C=C, max_iter=5000, class_weight="balanced").fit(Xtr, ytr) for C in (0.3, 1, 3, 10, 30)),
               key=lambda m: (m.predict(Xva) == yva).mean())
    print("chosen C", best.C)
    report("val", best, Xva, yva)
    acc = report("test", best, Xte, yte)
    ev = os.path.join(ROOT, "ml", "data", "eval")
    clean = sorted(glob.glob(os.path.join(ev, "panel_clean", "*.jpg")))
    dirty = sorted(glob.glob(os.path.join(ev, "panel_dusty", "*.jpg")) + glob.glob(os.path.join(ev, "panel_birds", "*.jpg")))
    real = report("real-world", best, load(clean + dirty), np.array([0] * len(clean) + [1] * len(dirty)))
    # 2-class logistic regression -> 2-row softmax weights: [-w/2, +w/2] gives the same probabilities
    w, b = best.coef_[0], best.intercept_[0]
    probe = {"classes": CLASSES, "weights": np.stack([-w / 2, w / 2]).round(6).tolist(), "bias": [round(float(-b / 2), 6), round(float(b / 2), 6)],
             "method": f"CLIP linear probe (test acc {acc:.2f}, real-world {real:.2f})"}
    with open(os.path.join(ROOT, "ml", "probe_condition.json"), "w", encoding="utf-8") as fh:
        json.dump(probe, fh)
    print("wrote ml/probe_condition.json")


if __name__ == "__main__":
    main()
