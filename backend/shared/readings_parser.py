"""Turn OCR text lines from an inverter-app screenshot into {date, kwh} rows.

Deterministic on purpose: the OCR (Amazon Textract) reads characters; this code decides
which characters are a date and which are the day's energy.
"""
import re
from datetime import date

MONTHS = {m: i + 1 for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}
_MON = r"(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?"

DATE_PATTERNS = [
    (re.compile(r"\b(20\d\d)[-/.](\d{1,2})[-/.](\d{1,2})\b"), lambda m, y: (int(m[1]), int(m[2]), int(m[3]))),
    (re.compile(r"\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d\d|\d\d)\b"),                      # Indian order: DD/MM/YYYY
     lambda m, y: (int(m[3]) + (2000 if len(m[3]) == 2 else 0), int(m[2]), int(m[1]))),
    (re.compile(rf"\b(\d{{1,2}})(?!\d)(?:st|nd|rd|th)?\s+{_MON}(?:\s+(20\d\d))?", re.I),
     lambda m, y: (int(m[3]) if m[3] else y, MONTHS[m[2][:3].lower()], int(m[1]))),
    (re.compile(rf"\b{_MON}\s+(\d{{1,2}})(?!\d)(?:st|nd|rd|th)?(?:,?\s+(20\d\d))?", re.I),
     lambda m, y: (int(m[3]) if m[3] else y, MONTHS[m[1][:3].lower()], int(m[2]))),
    (re.compile(r"\b(\d{1,2})[/-](\d{1,2})\b(?![/.-]\d)"), lambda m, y: (y, int(m[2]), int(m[1]))),  # DD/MM (no dot: 12.4 is kWh)
]
NUMBER = re.compile(r"(?<![\d.])(\d{1,6}(?:[.,]\d{1,3})?)\s*(kwh|kw·h|wh|units?)?", re.I)
TODAY = re.compile(r"\b(e[-\s]?today|today|daily\s+(?:energy|yield|generation)|today'?s\s+(?:energy|yield|generation))\b", re.I)


def find_date(text, default_year):
    for pat, conv in DATE_PATTERNS:
        m = pat.search(text)
        if m:
            try:
                y, mo, d = conv(m, default_year)
                return date(y, mo, d), m.span()
            except (ValueError, KeyError):
                continue
    return None, None


def find_kwh(text, skip_span=None):
    """The energy value on a line: prefer a number followed by kWh/Wh; otherwise the last plain number."""
    best = None
    for m in NUMBER.finditer(text):
        if skip_span and m.start() < skip_span[1] and m.end() > skip_span[0]:
            continue
        value = float(m[1].replace(",", "."))
        unit = (m[2] or "").lower()
        if unit == "wh":
            value /= 1000
        if unit:
            return value
        best = value
    return best


def parse_lines(lines, today, max_kwh):
    """lines: OCR lines in reading order. Returns (rows, warnings)."""
    rows, warnings = {}, []
    for i, line in enumerate(lines):
        if TODAY.search(line):
            kwh = find_kwh(line[TODAY.search(line).end():])
            nxt = lines[i + 1] if i + 1 < len(lines) else ""
            if kwh is None and find_date(nxt, today.year)[0] is None:    # a heading above a dated list is not "today"
                kwh = find_kwh(nxt)
            if kwh is not None and 0 <= kwh <= max_kwh:
                rows.setdefault(today, kwh)
            continue
        d, span = find_date(line, today.year)
        if d is None:
            continue
        if d > today and d.replace(year=d.year - 1) <= today:   # "28 Dec" seen in January
            d = d.replace(year=d.year - 1)
        kwh = find_kwh(line, span)
        if kwh is None and i + 1 < len(lines) and find_date(lines[i + 1], today.year)[0] is None:
            kwh = find_kwh(lines[i + 1])
        if kwh is None:
            continue
        if not 0 <= kwh <= max_kwh:
            warnings.append(f"Skipped {d.isoformat()}: {kwh:g} kWh is not possible for this system.")
            continue
        rows[d] = kwh
    return [{"date": d.isoformat(), "kwh": round(k, 2)} for d, k in sorted(rows.items())], warnings
