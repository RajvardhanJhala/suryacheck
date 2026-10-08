# Decisions log

## 2026-10-08: Physics checked on real weather
- Open-Meteo for 23.09N 72.58E: the last rain of 5 mm or more was **2026-09-19**. The dry spell starts Sep 20.
- A 3 kWp roof at 23° tilt facing south gives about 14–15 kWh a day expected on clear October days. The planning estimate was about 13.6. The ₹ figures in the demo must come from code, not from PLAN.md.

## 2026-10-08: Soiling needs a statistically real decline
- The multi-seed test found a false "dust" verdict on a clean roof. Two causes: the decline was measured with the noisy 3-day median, and the slope's 95% confidence interval included zero.
- Fix: the decline is now measured along the fitted Theil-Sen trend (`-slope × segment length`), and the upper 95% bound of the slope must be below zero.
- Measured over 300 seeds with 3% daily noise:
  - clean roofs: 99% Healthy, 1% false Soiling;
  - dust at 0.6% a day: 100% detected;
  - a −30% string fault: 100% detected.

## 2026-10-08: Fault rule uses the detected step itself
- The fault rule uses the step's own before and after medians, held for at least 3 high-confidence days (step age 3–10 days). It no longer uses `med7_prior − med3`, because that mixes post-step days into the "before" window.

## 2026-10-08: Cedar is the action gate
- `backend/policies/actions.cedar` mirrors `rules.ACTIONS`. `tests/test_authz.py` checks the full verdict × action × loss matrix.
- Extra rule: a simulated site can never message a real phone number.

## 2026-10-08: Agent container is deployed (risk R3 cleared)
- The image is `public.ecr.aws/lambda/python:3.13` with pvlib 0.16.1, pandas, scipy, Strands, cedarpy and Powertools. It is about 1.4 GB, built with Docker Desktop (WSL2) and deployed with `sam deploy --resolve-image-repos`.
- A cold start takes about 14 s, which is acceptable because analyses run asynchronously (202 + polling).
- Fixed: Open-Meteo hours are hour-ending, so the first day of a request was partial and showed 0 kWh, which would look like a fake inverter trip. Days with fewer than 24 hourly values are now dropped.
- Runtime is Python 3.13 throughout, to match the local interpreter that `sam build` uses.

## 2026-10-08: Bedrock is blocked by new-account verification
- Every Claude and Nova model returns `AccessDeniedException: Your account is currently being verified`. Re-check with `scripts/check_bedrock.py`.
- India-only inference profiles exist (`in.anthropic.claude-haiku-4-5-20251001-v1:0`, `in.anthropic.claude-sonnet-5`). Prefer them so data stays in India.

## 2026-10-08: Phase 2 data layer is live
- Neighbours: each site's META item carries `pi_norm_series` (the last 60 high-confidence days) and `GSI1PK=GEO#<geohash5>`. Finding neighbours is one GSI query per analysis, instead of one per day as planned. It gives the same comparison with fewer reads.
- Weather: Open-Meteo is cached per geohash5 cell per day as a gzipped payload (`WX#<cell>` / `FETCH#<date>`, 2-day TTL), so there is one external call per neighbourhood per day.
- The api Lambda is built with `sam build --use-container`, so the Pillow and cedarpy wheels are Linux builds.
- E2E (`scripts/e2e.py`): synthetic dust from Sep 20 at 0.75%/day on real weather → **SOILING, ₹294/month, CLEAN_PANELS**, with the analysis done in 9 s. The PLAN.md band of ₹320–420 was a guess; the demo seed will use the code's own number.
