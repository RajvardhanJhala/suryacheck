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
