import numpy as np

from vision.clip import head_probs


def test_two_row_probe_matches_logistic_regression():
    # ml/train_probe.py stores a binary LR (w, b) as softmax rows [-w/2, +w/2]; P(dirty) must equal sigmoid(w.e + b)
    rng = np.random.default_rng(0)
    w, b, e = rng.normal(size=512), 0.7, rng.normal(size=512)
    head = {"classes": ["clean", "dirty"], "weights": [(-w / 2).tolist(), (w / 2).tolist()], "bias": [-b / 2, b / 2]}
    assert abs(head_probs(e.astype(np.float32), head)["dirty"] - 1 / (1 + np.exp(-(w @ e + b)))) < 1e-3
