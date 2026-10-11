# ML improvement plan: panel soiling, photo type, and reading extraction

**For:** a coding agent working on SuryaCheck's vision and reading-extraction models.
**Goal:** make the models better without risking the live build at
https://main.d2tnx3nqu0sqfs.amplifyapp.com (AWS stack `suryacheck`, `ap-south-1`).
Every change ships only through a pull request that passes the gates below.

---

## 0. Non-negotiable rules

1. **The verdict never comes from a photo.** The diagnosis (Healthy, Dust, Fault, Below expected…)
   comes only from measured output vs the physics estimate (`backend/physics/`). Photo models are a
   *visual estimate* shown beside it, and must stay that way. Do not wire photo outputs into
   `backend/physics/rules.py`, `backend/policies/actions.cedar`, money or actions.
2. **Never deploy to the live stack or AWS account.** Do not run `sam deploy` against `suryacheck`,
   and do not run `scripts/deploy_frontend.py`. The template also cannot be deployed as a second
   stack in the same account: `AgentFunction` has a fixed name (`suryacheck-agent`) and the scheduler
   uses `recheck-*` names. Work locally (section 2). The core team deploys after merging.
3. **Work on a branch** (`ml/<topic>`), open a PR to `main`, and never push to `main` directly.
4. **Keep the output contracts** in section 3 byte-for-byte compatible. The frontend and API depend
   on them.
5. **Only use data with a clear licence** (CC0, CC BY, MIT, Apache-2.0, or the team's own photos with
   consent). Record every source in a data card (section 5). Strip EXIF GPS from team photos. Never
   commit datasets or model weights over 1 MB; `ml/data/` and `ml/models/` are gitignored for that
   reason.
6. **Do not touch:**
   - `backend/physics/`, `backend/policies/`, `backend/shared/` (except new files of your own);
   - `backend/agent/`, `template.yaml`, `.env`, `scripts/deploy_*`;
   - the frontend, except the one threshold named in section 6.

---

## 1. What exists today (verified numbers)

| Piece | Where | How it works | Current quality |
|---|---|---|---|
| **Photo type** (panel / inverter / meter / screenshot / other) | `backend/vision/clip.py`, `backend/vision/heads.json` (`kind` head) | CLIP ViT-B/32, quantised ONNX (Xenova export), zero-shot text prompts from `ml/build_heads.py` | 30/55 on the real-world set: clean panels 10/10, dusty 5/12, bird droppings 0/9, inverter 7/12, meter 8/12 |
| **Panel condition** (clean / dirty) | same, `condition` head; trained by `ml/train_probe.py` → `ml/probe_condition.json` | Logistic-regression probe on CLIP image embeddings | Held-out test 86.9%. **Shown only at ≥ 0.8 confidence: 195/200 = 97.5% correct** (shows on ~53% of photos). Real-world panels: 8 correct of 9 shown |
| **Corroboration** | `backend/api/app.py` → `classify_photo` | Amazon Rekognition `DetectLabels` ("Solar Panels" confidence) | Reliable for panels vs not-panels; says nothing about dirt |
| **Reading extraction** | `backend/api/extraction.py`, `backend/shared/readings_parser.py` (tests: `tests/test_readings_parser.py`) | Amazon Textract (`DetectDocumentText` for lists, `AnalyzeDocument` Queries for single values) + deterministic parser; the user confirms every number as editable chips | Good on clean app screenshots; weak on seven-segment inverter LCDs and glare |
| **Runtime** | `VisionFunction` Lambda (container `backend/vision/Dockerfile`, 2048 MB, 30 s timeout) | numpy + onnxruntime only, no PyTorch | ~1 s warm, 12–28 s cold |

**Known weaknesses, ranked by value to fix:**
1. **Domain shift.** The condition probe was trained on close-up phone photos (Hugging Face
   `adityashirsatrao007/solar-dust-data-combined`, a re-upload of Kaggle sets **with no stated
   licence**). On wide or rooftop shots it drops to ~55%. Replacing this training data with licensed
   data is also a compliance fix.
2. **Photo type** misses dusty and bird-dropping close-ups (they read as meter or screenshot). The app
   then asks the user, but a trained head would fix it.
3. **Inverter LCD photos**: seven-segment digits and glare defeat Textract's single-value queries.

---

## 2. Local setup (no AWS deploys needed)

```bash
git checkout -b ml/<topic>
python -m venv .venv && .venv/Scripts/pip install -r ml/requirements.txt    # dev deps + onnxruntime, tokenizers, scikit-learn, Pillow
python ml/build_heads.py            # downloads CLIP ONNX + tokenizer to ml/models/clip, writes backend/vision/heads.json
python -m pytest tests -q           # must stay green (69 tests at the time of writing)
```

- **Classify a photo locally**, exactly as the Lambda does:
  ```bash
  python -c "import sys; sys.path.insert(0,'backend'); from vision.clip import classify_bytes; print(classify_bytes(open('x.jpg','rb').read()))"
  ```
- **Test extraction locally** with your own AWS credentials: call `extract_rows` from
  `backend/api/extraction.py`. Use a **separate AWS account or your own S3 bucket**, never the live
  bucket. Textract calls cost money, so keep runs small.
- **The real-world eval set (55 photos) is not in git.** Ask Rajvardhan for the `ml/data/eval/`
  folder (`panel_clean`, `panel_dusty`, `panel_birds`, `inverter`, `meter`) and treat it as frozen.
  Better: rebuild it with a manifest (section 5), so it can be committed and shared.

---

## 3. Contracts that must not change

**Vision** (`classify_bytes(data: bytes) -> dict`, returned by the Lambda and stored per photo):
```json
{ "kind": "panel|inverter|meter|screenshot|other",
  "kind_probs": {"panel": 0.93, "...": 0.01}, "kind_method": "free text",
  "condition": "clean|dirty", "condition_probs": {"clean": 0.06, "dirty": 0.94}, "condition_method": "free text" }
```
- Probabilities sum to 1 per head.
- `condition` is computed for every photo; the frontend only shows it for panels, at ≥ `CONFIDENT`.
- You may **add** condition classes (e.g. `bird_droppings`, `damaged`) only together with labels in
  `frontend/src/app/photos.tsx` (`COND_LABEL`), and only if each new class meets the gate.

**Heads file** (`backend/vision/heads.json`): per head, `classes`, `text_embeds`, `weights`
(rows = classes, 512 columns, or the new backbone's dimension), `bias`, `method`. A linear probe
plugs in with no code change. A different backbone or a fine-tuned network needs a new ONNX file in
the vision image plus a small change in `clip.py`, kept behind an env var with the current model as
the default (section 6).

**Extraction** (`extract_rows(bucket, keys, kind, max_kwh) -> dict`):
```json
{ "kind": "...", "rows": [{"date": "YYYY-MM-DD", "kwh": 12.4}], "values": {"total_kwh": {"value": 4512, "confidence": 91}},
  "warnings": ["..."], "engine": "Amazon Textract" }
```
- Precision matters more than recall. A missing number is fine, because the user can type it.
  A wrong number that looks right is not.

---

## 4. Workstreams (in priority order)

### A. Evaluation harness first (blocks everything else)
- Add `ml/eval_vision.py`. It runs `classify_bytes` over a frozen set and writes
  `ml/reports/<date>-<model>.json` with:
  - the kind confusion matrix;
  - condition precision, recall and coverage at thresholds 0.5–0.95;
  - expected calibration error;
  - warm latency.
- Commit the report for the **current** model first. That is the baseline every PR is compared to.
- Add `ml/eval_extraction.py`. It runs `extract_rows` over a labelled set of screenshots and photos
  (truth = the exact rows) and reports:
  - row precision and recall;
  - **wrong-number rate** (rows present with a wrong kWh or date);
  - single-value accuracy for meters.

### B. Better clean/dirty model (biggest win)
1. **Data.** Collect licensed data and keep a data card:
   - Roboflow "solar panel clean/dirty" sets under CC BY 4.0 (one has ~2.5k images; needs a free
     `ROBOFLOW_API_KEY`).
   - Kaggle sets only if their licence page allows it.
   - Team photos of real Indian rooftops (wide and close shots, morning and noon, phone cameras).
     These are the most valuable.
2. **Splits.**
   - Deduplicate with a perceptual hash.
   - Split **by source or shoot, not by image**: the current data has near-duplicate frames, which
     inflate test scores.
   - Keep the real-world set held out entirely.
3. **Models, cheapest first.** Stop at the first one that passes the gate.
   - **(a)** Retrain the CLIP linear probe on the licensed data, with crop augmentation and
     temperature scaling. Same file format; no code change.
   - **(b)** Same probe on a stronger frozen backbone with an ONNX export, e.g. CLIP ViT-B/16 or
     SigLIP-base. Check the image size and that warm latency stays ≤ 2 s on 2048 MB.
   - **(c)** Fine-tune a small CNN (MobileNetV3 or EfficientNet-B0) and export quantised ONNX. Only
     if (a) and (b) fail on real-world photos.
4. **Threshold.** Pick `CONFIDENT` on validation data as the lowest threshold with precision ≥ 95%.
   Report its coverage.

### C. Trained photo-type head
- Label about 100+ photos per class (panel, including dirty and bird-dropping close-ups; inverter
  display; meter; app screenshot; other).
- Train a probe exactly like workstream B(a) and replace the zero-shot `kind` head.
- Gate: ≥ 50/55 on the real-world set, and no class worse than today.

### D. Reading extraction
1. **No new model needed first.**
   - Collect 100+ real screenshots from common Indian inverter apps (Growatt ShinePhone, Solis Cloud,
     Sungrow iSolarCloud, Huawei FusionSolar, Luminous, Havells, Tata Power) and LCD photos, with
     ground-truth rows.
   - Turn each failure into a parser test in `tests/test_readings_parser.py` and fix the parser.
2. **Own OCR model (optional, bigger effort).**
   - Add PaddleOCR (Apache-2.0) or a seven-segment digit model as ONNX in a **separate** Lambda.
   - Use it as a fallback when Textract returns no rows, or as a cross-check: keep a number only when
     both agree, otherwise leave the chip empty for the user.
   - Same contract and the same parser.
3. **Do not** depend on Amazon Bedrock; it is blocked on this account.

### E. Rekognition
- Keep it as corroboration only.
- Do **not** use Rekognition Custom Labels: it bills per inference hour while the model is running
  (about $4/hour), which is not viable for this project.

---

## 5. Data card (required in every data PR): `ml/DATA_CARD.md`

For each source, record:
- name, URL and licence (with a link to the licence);
- image count per class, and how the labels were made;
- what was deduplicated or removed;
- the split rule;
- for team photos: who took them, that consent was given, and that EXIF GPS was stripped.

Any eval set you want committed needs `ml/data/eval/MANIFEST.csv` with
`file,label,source_url,author,licence`. Keep the attribution text with it.

---

## 6. How a change reaches production

0. Before starting: the repo owner pushes the latest `main`, and grants you collaborator access (the repo is private).
1. Open a PR from `ml/<topic>` that contains:
   - the new `heads.json` and/or a small ONNX file (or a download step in `backend/vision/Dockerfile`
     for large weights, pinned by URL and SHA-256);
   - the eval report JSON, before vs after;
   - `ml/DATA_CARD.md`;
   - unit tests in the style of `tests/test_vision_probe.py`;
   - any `CONFIDENT` change in `frontend/src/app/photos.tsx`, justified by the report.
2. **Gates (all required):**
   - [ ] `python -m pytest tests -q` passes; `cd frontend && npx tsc -b && npm run build` passes.
   - [ ] Condition: on the held-out test **and** the real-world set, precision at the chosen threshold
         is ≥ today's (97.5% test; 8/9 real), **and** real-world coverage is higher than today's.
   - [ ] Kind: no class drops below today's real-world score.
   - [ ] Extraction: wrong-number rate ≤ today's on the labelled set; recall not lower.
   - [ ] Warm latency ≤ 2 s per photo locally (CPU); vision container image ≤ 1.5 GB.
   - [ ] Output contract (section 3) unchanged; any new model sits behind an env var (e.g.
         `VISION_MODEL=clip-b32|<new>`) whose default is the current model.
   - [ ] Only licensed data, with the data card filled in.
3. The core team reviews, merges, deploys to the `suryacheck` stack, and runs
   `python scripts/e2e_vision.py <photos>` against it.
4. **Rollback** = revert the PR (or flip the env var) and redeploy. Stored photo results are
   per-photo and harmless to keep.

---

## 7. Suggested first PRs (each is small and independently mergeable)

1. `ml/eval-harness`: workstream A plus a baseline report for the current model.
2. `ml/licensed-condition-data`: data card plus a retrained probe on licensed data (B(a)).
3. `ml/kind-head`: trained photo-type head (C).
4. `ml/parser-cases`: real inverter-app screenshots turned into parser tests and fixes (D.1).
