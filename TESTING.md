# TESTING.md — Cat Care Log

Verified 2026-10-06 before handoff. Everything below was actually run.

## 1. JS syntax (`node --check`)

| File | Result |
|---|---|
| `js/store.js` | OK |
| `js/app.js` | OK |
| `js/charts.js` | OK |
| `test/store.test.js` | OK |

## 2. Logic unit tests (`node test/store.test.js`)

**33 passed, 0 failed.**

Covered:
- Cat CRUD: rejects empty names, add/switch/remove, per-cat entry isolation
- Logging: all 6 entry types with fields, rejects unknown types, entry delete
- Streaks: 3-day streak, 1-day streak, gap breaks streak, empty cat = 0
- `feedingsByDay`: correct per-day counts over 3 days
- `weightPoints`: sorted oldest-first; kg/lb conversion both directions; bad unit rejected
- Export/import round-trip: 2 cats + 9 entries survive, streak recomputes identically
- Import validation: 5 malformed blobs rejected (`not json`, missing arrays, bad entry shape), state untouched after failed import
- `removeCat` deletes the cat and its entries; `wipe` clears everything

Note: one test expectation was wrong on first run (expected 8 entries after cat removal, correct is 7); the store code was right, the test was fixed, full suite re-run green.

## 3. CDN availability (`curl`)

- `https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js` → **HTTP 200**
- Google Fonts Nunito CSS → **HTTP 200**

The charts module also has a graceful fallback: if ECharts fails to load, each chart area shows a friendly message instead of breaking.

## 4. Not yet verified (needs a real device/browser)

- Camera/file photo upload path (`handlePhotoUpload`) and localStorage quota behavior with large photos. Photo is downscaled to max 256px JPEG before storing to mitigate this.
- Visual QA on iPhone Safari: bottom sheet, tab bar safe-area insets, chart rendering at 360px width.
- GitHub Pages deploy: enable Pages on  `SerenaWuuu/cat-care-log` (Settings → Pages → Deploy from branch → main → /(root)).
