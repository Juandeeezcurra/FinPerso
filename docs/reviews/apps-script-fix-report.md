---
phase: adhoc
fixed_at: 2026-04-27T20:08:37Z
review_path: REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 11
skipped: 0
status: all_fixed
---

# Code Review Fix Report — FinPerso v12

**Fixed at:** 2026-04-27T20:08:37Z
**Source review:** REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (Critical + Warning): 11
- Fixed: 11
- Skipped: 0

## Fixed Issues

### CR-01 + CR-02: Add shared-secret token auth to doGet and doPost

**Files modified:** `apps-script/FinPerso_v12_script.gs`
**Commit:** 90c37f9
**Applied fix:**
- Added `ALLOWED_SHEETS` constant at top of file listing the four permitted sheet names plus Benchmark.
- Added `ORDENES_VALIDAS`, `MONEDAS_VALIDAS`, `TIPOS_VALIDOS` allowlist constants (also used by CR-03).
- `doGet`: reads `API_TOKEN` from `PropertiesService.getScriptProperties()`. If the property is set and `e.parameter.token` does not match, returns `{ error: "Unauthorized" }`. Also gates on `ALLOWED_SHEETS` before proceeding.
- `doPost`: reads `API_TOKEN` immediately after parsing the payload. If set and `payload.token` does not match, returns `{ error: "Unauthorized" }`.
- Token check is opt-in: if the Script Property is not set the endpoint remains open (safe for local dev; set the property to lock down production).

---

### CR-03: Allowlist validation for orden, moneda, tipo in doPost

**Files modified:** `apps-script/FinPerso_v12_script.gs`
**Commit:** 721b5c4
**Applied fix:** Added three allowlist arrays (`ORDENES_VALIDAS`, `MONEDAS_VALIDAS`, `TIPOS_VALIDOS`) at the top of the AUTH section. After the existing required-fields check in both the `editOp` handler and the default new-operation handler, added three `indexOf` checks that return a `{ error: ... }` response for any value not in the allowlist.

---

### CR-04: Guard null indicators in `_getBenchmarkData`

**Files modified:** `apps-script/FinPerso_v12_script.gs`
**Commit:** 20a650b
**Applied fix:** Replaced the bare `result.indicators.quote[0].close` access with the same defensive chain used in `_getPrecioYahoo`: `(result.indicators && result.indicators.quote && result.indicators.quote[0] && result.indicators.quote[0].close) || []`. Added `if (closes.length === 0) return [];` guard immediately after to short-circuit processing when the array is empty.

---

### WR-01: Clamp prop to [0,1] and warn on oversell in recalcularPortfolio

**Files modified:** `apps-script/FinPerso_v12_script.gs`
**Commit:** b67b60c
**Applied fix:** In the `Venta` branch of `recalcularPortfolio`, added a `Logger.log("WARN: …")` before computing `prop`, and replaced the raw division with `Math.min(1, nominales / resumen[ticker].nominales)` so `prop` is clamped to [0, 1]. This prevents `costoARS` from going negative when a venta exceeds the recorded nominales.

---

### WR-02: Cache CCL historical data before forEach in completarOperaciones

**Files modified:** `apps-script/FinPerso_v12_script.gs`
**Commit:** 13ca58b
**Applied fix:** Split `_getCCLHistorico` into three functions:
- `_fetchCCLHistData()` — performs the single HTTP call and returns the raw array (or `null` on error).
- `_lookupCCLFromData(datos, fecha)` — pure lookup in an already-fetched array.
- `_getCCLHistorico(fecha)` — convenience wrapper that calls both (used by `onEdit`, `doPost`, etc., where a single call per invocation is fine).

In `completarOperaciones`, `_fetchCCLHistData()` is called once before the `forEach`, and each row uses `_lookupCCLFromData(cclHistData, fecha)` — eliminating N HTTP calls per run.

---

### WR-03: Add regex validation to `_parseFecha`

**Files modified:** `apps-script/FinPerso_v12_script.gs`
**Commit:** 92a540e
**Applied fix:** Rewrote `_parseFecha` to:
1. Reject `null`, non-string, or empty input with `throw new Error("Fecha inválida: …")`.
2. Detect `dd/mm/yyyy` with `/^\d{2}\/\d{2}\/\d{4}$/` and `yyyy-mm-dd` with `/^\d{4}-\d{2}-\d{2}$/`.
3. Throw `"Formato de fecha no reconocido: …"` for anything else (ISO datetime strings, US format, etc.).

---

### WR-04: Fix snapshotSemanal fallback to find closest-to-7-days entry

**Files modified:** `apps-script/FinPerso_v12_script.gs`
**Commit:** cfa08bc
**Applied fix:** Replaced the backwards-with-early-break loop with a forward full-scan that computes `distancia = Math.abs(diff - 7*86400000)` for each entry older than 1 day, tracking the minimum-distancia entry. This guarantees the entry closest to exactly 7 days ago is selected regardless of the order or density of historical records.

---

### WR-05: Remove dead `rows` variable in doGet

**Files modified:** `apps-script/FinPerso_v12_script.gs`
**Commit:** 3b94b95
**Applied fix:** Removed the unused `var rows = data.slice(1).filter(...)` line (line 1462 in the original). The downstream `for` loop already re-filters by checking `r[0] !== ""`, so the pre-filtered array was never consumed.

---

### WR-06: Add deprecation comment to `_guardarPrecioAyer`

**Files modified:** `apps-script/FinPerso_v12_script.gs`
**Commit:** 5704406
**Applied fix:** Added a JSDoc block above `_guardarPrecioAyer` explaining that it is no longer called from `actualizarTodo`, that `actualizarPrecios()` now writes `precioAyer` via Yahoo's `previousClose`, and that calling this function after price update will zero out daily variation. Marked `@deprecated` with a "do NOT invoke manually" warning.

---

### WR-07: Fix `_toNum` European integer-thousands pattern

**Files modified:** `apps-script/FinPerso_v12_script.gs`
**Commit:** 900446d
**Applied fix:** Added a third branch in `_toNum` that detects European integer-thousands format (e.g. `"1.234"` or `"1.234.567"`) using the regex `/^\d{1,3}(\.\d{3})+$/` and strips the dots before parsing. The existing branches for `"1.234,56"` (both dot and comma) and `"1,234"` (comma only) are unchanged.

---

## Skipped Issues

None — all findings were fixed.

---

_Fixed: 2026-04-27T20:08:37Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
