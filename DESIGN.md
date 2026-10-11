# SuryaCheck design system

## Concept: the solar instrument
SuryaCheck should feel like a precise, trustworthy measuring instrument, partly a sundial and partly an energy meter. Headings are warm and human. Numbers look like instrument output. Every colour means exactly one thing.

Source files:
- `frontend/src/ui/tokens.css`: the tokens.
- `frontend/src/ui/base.css`: base styles and component styles.
- `frontend/src/ui/arc.tsx`: the motif.
- `frontend/src/ui/icons.tsx`: the icon set.
- `frontend/src/ui/primitives.tsx`: the components.

A live reference is at `/brand`.

## Signature motif: the sun-path arc
A semicircle runs from sunrise (left) through noon (top) to sunset (right), above a horizon line. The sun sits on the arc at a position `t` from 0 to 1. One geometry function, `arcPoint` in `arc.tsx`, drives every use:

| Use | Rule |
|---|---|
| Logo | The arc, a horizon line, three dial ticks, and the sun at t = 0.68 (mid-afternoon: "checked today"). |
| Performance gauge | The arc fills to the performance ratio, and the sun marks the value. The fill is **clean** at 92% or above and **dust** below, and a text label always says the same thing. |
| Loader | The sun travels the arc in 1.6 s. Under `prefers-reduced-motion` it stays still at noon. |
| Section divider | A horizon line with a small low arc and sun. Used between major sections only. |
| 404 page and empty states | The sun has set below the horizon ("nothing here yet"). |

Never use the arc as pure decoration, and never draw the sun in any colour other than `--sun`.

## Colour: one meaning per colour
| Token | Light | Dark | Means |
|---|---|---|---|
| `--paper` | #f4eee2 | #14110c | Page background |
| `--surface` | #fbf8f1 | #1d1913 | Cards |
| `--sunken` | #ebe3d3 | #0f0d09 | Wells and gauge tracks |
| `--ink` | #1f1b14 | #f1eadc | Text |
| `--ink-2` | #5b5345 | #b9ae9a | Secondary text |
| `--line` | #d9cfbc | #3a3227 | Hairlines |
| `--sun` / `--sun-ink` | #e8890c / #8f4a00 | #f29a2e / #f6b25c | Primary action and energy. Button text is always ink, never white. |
| `--dust` / `--dust-ink` / `--dust-bg` | #b67d2c / #7c5313 / #f3e3c3 | #d69c4c / #e5b56f / #2f2414 | **Only** soiling or money lost |
| `--clean` / `--clean-bg` | #1d6c74 / #d8eae8 | #6fc0c6 / #12292b | **Only** healthy or recovered |
| `--fault` / `--fault-bg` | #b3361f / #f6ddd5 | #ff8e7c / #33150f | **Only** electrical faults and errors |

**One change from the brief: I added `--fault`.** An electrical fault is a loss, but it isn't dust, and the action is different (call the installer, not a cleaner). Showing it in dust ochre would teach users the wrong thing, so faults and errors get their own colour.

**Rules:**
- Colour never carries meaning on its own. Every badge, notice and gauge also has a text label and an icon.
- No gradients and no glassmorphism.

**Contrast:** every text pair passes WCAG AA in both themes. The script lives in the git history (2026-10-10). The minimum is dust-ink on dust-bg at 5.3:1 in light mode, and button text on sun is 6.5:1.

## Typography
| Role | Face | Use |
|---|---|---|
| Display | **Fraunces** (variable, self-hosted) | h1–h3. Warm and slightly old-world, like engraving on a sundial. |
| Text | **Noto Sans**, with **Noto Sans Devanagari** | Body text, labels and Hindi. |
| Readings | **IBM Plex Mono**, tabular figures | Every kWh, ₹, %, kWp and date in a table. |

- **Size scale (rem):** .75, .875, 1, 1.125, 1.375, 1.75, 2.25, 3, 4 (tokens `--fs-xs` to `--fs-5xl`). h1 and h2 scale fluidly with `clamp()`.
- **Numbers:** `font-variant-numeric: tabular-nums` is on globally, so numbers that update don't jiggle.
- **Units:** units are set at 45% size in `--ink-2` (`.reading small`).

## Scales
- **Spacing** (`--s-1` to `--s-9`): 4, 8, 12, 16, 24, 32, 48, 64, 96 px. Nothing else is used.
- **Radius:**
  - `--r-xs` 4: focus rings;
  - `--r-sm` 8: small wells;
  - `--r-md` 12: inputs and notices;
  - `--r-lg` 20: cards;
  - `--r-pill`: buttons and badges.
- **Shadow:**
  - `--sh-1`: resting cards;
  - `--sh-2`: raised and hover;
  - `--sh-3`: overlays.

  Shadows have a warm tint and are never pure black in light mode.
- **Touch:** `--tap` is 44 px, the minimum height of anything you can tap.

## Motion
Motion is calm, follows curves like the sun's path, and always has a purpose. Durations are 300–600 ms
with `--ease` (ease-out); there are no springs, bounces or decorative-only loops:
- **Readings count up** once, when they scroll into view (900 ms, ease-out cubic), including the
  landing trust stats.
- **The gauge sweeps** to its value in 1.2 s.
- **The logo's sun follows the real sun:** on load it sweeps from sunrise to the current time in
  Ahmedabad (600 ms, along the arc), then updates every minute (`lib/sun.ts`, NOAA approximation).
- **The landing dust panel** (`site/DustPanel.tsx`, one `<canvas>`) runs a 14 s loop. Over "Day 1–20
  since last wash", dust builds at the report's own soiling rate (`soilingAfter` in `lib/money.ts`):
  100% → 88% output and ₹0 → ₹311 a month. The loop ends alternately in rain or a squeegee
  cleaning. Dragging the pointer or a finger over the panel pauses the loop and wipes like a cloth,
  with live % and ₹; after 3 s idle the dust resettles. The dust uses a seeded PRNG with at most 600
  particles, is devicePixelRatio-aware, and pauses off-screen.

`prefers-reduced-motion` sets every duration to 0 and shows final values immediately; the dust panel
becomes a static dusty-vs-clean pair. Web fonts use `font-display: optional`, so they never shift the
layout.

## Icons
There's one custom line family: a 24-unit grid, 1.75 stroke, round caps and joins, drawn in `currentColor` (`icons.tsx`). No emoji are used as icons. When an icon carries meaning it gets an `aria-label`; otherwise it's hidden from screen readers.

## Components
- `Button`: primary (sun), secondary or ghost, with an optional icon. 44 px tall, pill-shaped.
- `Card`: surface colour, a hairline border, `--r-lg` and `--sh-1`.
- `Badge`: uppercase mono text with an optional icon, in neutral, dust, clean, fault or sun tones.
- `Reading`: an instrument number with a unit, a tone and the count-up.
- `Field`: a label, an input, and a hint or error linked with `aria-describedby`.
- `Notice`: an inline success, error or info message, always with an icon and a title.
- `ArcGauge`, `ArcLoader`, `ArcDivider`, `Logo` and `LogoMark`: the motif components.

## The app: one path, "Test your roof"
Routes: `/` landing, `/test` the flow, `/r/:id` a saved report, `/history`, `/settings`, `/how-it-works`.
The old `/app/*` and `/sample/*` addresses redirect to these. Navigation has three items, Test, History
and Settings: a slim top bar on desktop and a bottom bar on mobile.

`/test` is one page.
1. **Two questions only.** Where the roof is, from browser location, then photo EXIF GPS, then an area
   or PIN code typed in. The page shows the locality name. The second question is system size,
   prefilled at 3 kWp. Everything else (tilt 23°, south, ₹6/unit, ₹200 per cleaning, install date)
   sits under one collapsed "Adjust assumptions". No setup form comes first.
2. **Three capture cards.** Inverter (required), net meter (optional) and panel photos (optional, live
   camera, 1–3 shots). Each card has one action. A used card shows its thumbnail with a tick, and the
   numbers read from it appear as editable chips (Amazon Textract reads them; you confirm them).
3. **Check my roof.** The progress line shows the analysis job's real stages (photos → sunshine →
   compare → diagnose); the job writes its stage to DynamoDB. If a step fails, the message names the
   step.
4. **Results on the same page.** The inputs collapse into a "Your readings" line with "Edit and
   re-run". On top: the gauge, one verdict word (colour plus icon plus word), one sentence built from
   computed numbers, and the money. Below that: collapsed sections (actual vs expected, panel photos,
   money over 12 months, method, nearby roofs only when real), then cleaners nearby, then
   Save/PDF/Recheck.

Sample mode is the same page (`/test?sample=…`), with a visible "Sample data" badge.

**One loss definition, everywhere:** *units below what the sunshine allowed on clear days, at your
electricity rate* (the backend's `monthly_loss_inr`). The 12-month projection starts at exactly that
rate, which `money.check.ts` asserts.

**Cleaners** come from a backend `CleaningProvider` adapter. Today that is Amazon Location Service
Places: real businesses only, with no invented names, ratings or prices. Call is offered when a phone
number exists, and WhatsApp only for Indian mobile numbers. A booking request is logged in DynamoDB
and emailed to `OpsEmail` when one is configured.

## Declutter rules (every screen)
- Every element is either an input the result depends on, or part of the answer. Anything else is
  deleted.
- At most one primary button per screen.
- Show the answer first; detail stays collapsed until asked for. Charts render only when their
  section opens.
- No info box repeats nearby text, and no card restates another card.
- Spacing, radius and type come from the existing tokens only; no new colours.

## Icons and social images
The mark is the sun's path drawn as a gauge, with the sun as the needle tip. Each size is drawn
separately: **16 px** has only the arc and sun, with a heavy stroke; **32 px** adds the baseline;
**180 px and up** has the full mark (track, filled arc, ticks, baseline). On a results page the tab's
sun takes the verdict colour (`lib/favicon.ts`), and the title shows the performance, e.g.
"88% · Dust · SuryaCheck".

`python scripts/make_icons.py` generates:
- `favicon.svg` (with a dark-mode variant inside the SVG), `favicon.ico` (16/32/48, each from its own
  drawing), and 16 and 32 px PNGs;
- `safari-pinned-tab.svg` (monochrome mask icon);
- `apple-touch-icon` (180 px);
- 192 and 512 px icons, plus a maskable 512 px icon;
- `og.png` at 1200×630, showing the gauge and a ₹ figure.

These all go into `frontend/public`.

## Avoided on purpose
- Purple or blue gradients, glassmorphism, 3D blobs and gradient text.
- The "hero, three feature cards, CTA" template, and default component-library styling.
