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
Motion is calm and always has a purpose:
- **Readings count up** once, when they scroll into view (900 ms, ease-out cubic).
- **The gauge sweeps** to its value in 1.2 s.
- **The dust overlay settles** in the landing demo.

`prefers-reduced-motion` sets every duration to 0 and shows final values immediately.

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

## Icons and social images
`python scripts/make_icons.py` generates, from the same mark geometry:
- `favicon.svg`, `favicon.ico`, and 16 and 32 px PNGs;
- `apple-touch-icon` (180 px);
- 192 and 512 px icons, plus a maskable 512 px icon;
- `og.png` at 1200×630.

These all go into `frontend/public`.

## Avoided on purpose
- Purple or blue gradients, glassmorphism, 3D blobs and gradient text.
- The "hero, three feature cards, CTA" template, and default component-library styling.
