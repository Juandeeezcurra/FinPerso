---
phase: adhoc
status: issues_found
files_reviewed: 2
findings:
  critical: 4
  warning: 7
  info: 4
  total: 15
---

# Code Review Report — FinPerso v12

**Reviewed:** 2026-04-27T00:00:00Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed the primary Apps Script backend (`FinPerso_v12_script.gs`, ~1494 lines) and the README. The script is a Google Apps Script web app that exposes `doGet`/`doPost` endpoints consumed by a static frontend hosted on Netlify.

The most serious problems are in the public API surface (`doGet`/`doPost`): both endpoints lack any form of authentication or authorization, all sheets in the spreadsheet can be read by anyone who knows the deployment URL, and several action handlers accept user-supplied values (ticker, orden, moneda, tipo) without whitelisting them against known-good values, enabling data-integrity attacks. A crash-on-null in `_getBenchmarkData` (line 1423) will surface as a 500 to callers whenever Yahoo's chart response is malformed. There are also logic bugs in the weekly-variation lookup that can silently produce wrong results.

---

## Critical Issues

### CR-01: `doGet` exposes all spreadsheet data without any authentication

**File:** `apps-script/FinPerso_v12_script.gs:1434-1493`
**Issue:** `doGet(e)` is a publicly accessible HTTPS endpoint (when deployed as a Web App with "anyone" access, which is required for a browser-side fetch). It accepts a `sheet` query parameter and returns the full contents of any named sheet in the spreadsheet — including the `Valores` sheet which contains the **email address** used for reports. Any anonymous HTTP client that knows the deployment URL can enumerate all sheets by guessing sheet names. There is zero authentication — no token check, no HMAC, no allowlist of sheet names.

**Fix:** Add an allowlist of sheets that may be exported, and/or require a shared secret token in the request:
```javascript
var ALLOWED_SHEETS = ["Portfolio", "Operaciones", "Efectivo", "Historial"];
var TOKEN = PropertiesService.getScriptProperties().getProperty("API_TOKEN");

function doGet(e) {
  if (!TOKEN || e.parameter.token !== TOKEN) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Unauthorized" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var sheet = e.parameter.sheet;
  if (ALLOWED_SHEETS.indexOf(sheet) === -1 && sheet !== "Benchmark") {
    return ContentService.createTextOutput(JSON.stringify({ error: "Hoja no permitida" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  // ... rest of handler
}
```

---

### CR-02: `doPost` accepts arbitrary write operations without authentication

**File:** `apps-script/FinPerso_v12_script.gs:1167-1392`
**Issue:** All mutating actions (`addEfectivo`, `deleteOp`, `editOp`, `updateEmail`, `updateNominalesCash`, `updatePrecioManual`) are accepted from any HTTP client with no authentication. An attacker who discovers the web app URL can delete all operations, change the report email to their own address (receiving portfolio data), inject arbitrary rows into the sheet, etc.

**Fix:** Same shared-secret token strategy as CR-01. Read the token from Script Properties (not from `CONFIG`, to avoid it being returned by `doGet`):
```javascript
function doPost(e) {
  var TOKEN = PropertiesService.getScriptProperties().getProperty("API_TOKEN");
  try {
    var payload = JSON.parse(e.postData.contents);
    if (!TOKEN || payload.token !== TOKEN) {
      return _jsonOut({ error: "Unauthorized" });
    }
    // ... rest of handler
  } catch(err) { ... }
}
```

---

### CR-03: Missing input validation on enumerated fields in `doPost` — data integrity

**File:** `apps-script/FinPerso_v12_script.gs:1194-1204, 1333-1342`
**Issue:** The `editOp` and default (new operation) handlers receive `orden`, `moneda`, and `tipo` from the request payload but only check that they are truthy — not that they are one of the expected values. A client can submit `orden = "BORRAR_TODO"`, `moneda = "EUR"`, or `tipo = "Agro"` (which won't match the data validation set on the sheet). This corrupts the portfolio calculation because `recalcularPortfolio` dispatches on exact string equality (`orden === "Compra"` / `"Venta"`) — an unexpected value passes the truthy check and the row is silently skipped during portfolio rebuild, producing a wrong total.

**Fix:** Validate against allowlists before processing:
```javascript
var ORDENES_VALIDAS = ["Compra", "Venta"];
var MONEDAS_VALIDAS = ["ARS", "USD"];
var TIPOS_VALIDOS   = ["Equity", "Bonos", "Crypto", "Cash", "Agro"];

if (ORDENES_VALIDAS.indexOf(orden) === -1) return _jsonOut({ error: "Orden inválida" });
if (MONEDAS_VALIDAS.indexOf(moneda) === -1) return _jsonOut({ error: "Moneda inválida" });
if (TIPOS_VALIDOS.indexOf(tipo)  === -1)    return _jsonOut({ error: "Tipo inválido" });
```

---

### CR-04: Crash in `_getBenchmarkData` on malformed Yahoo response

**File:** `apps-script/FinPerso_v12_script.gs:1423`
**Issue:** Line 1423 accesses `result.indicators.quote[0].close` without any null guard. In `_getPrecioYahoo` (line 389) the same path is carefully guarded with optional chaining (`result.indicators && result.indicators.quote && result.indicators.quote[0] && result.indicators.quote[0].close`). But `_getBenchmarkData` only checks `!result.timestamp` (line 1420) and then accesses `result.indicators.quote[0].close` unconditionally. If Yahoo returns a result with no `indicators`, a null `quote` array, or an empty `quote[0]`, this throws a `TypeError`, which surfaces as a 500 response to the dashboard.

```javascript
// Line 1423 — CRASHES if indicators or quote is absent/empty
var closes = result.indicators.quote[0].close;
```

**Fix:** Apply the same guard used in `_getPrecioYahoo`:
```javascript
var closes = (result.indicators && result.indicators.quote &&
              result.indicators.quote[0] && result.indicators.quote[0].close) || [];
if (closes.length === 0) return [];
```

---

## Warnings

### WR-01: Venta before Compra (or overselling) produces negative `prop` and wrong cost basis

**File:** `apps-script/FinPerso_v12_script.gs:618-622`
**Issue:** When `recalcularPortfolio` encounters a `Venta` row, it computes:
```javascript
var prop = resumen[ticker].nominales > 0 ? nominales / resumen[ticker].nominales : 0;
resumen[ticker].costoARS -= resumen[ticker].costoARS * prop;
```
If operations are not in strict chronological order, or if a user logs a partial venta when no compra exists yet for that ticker, `prop` is 0 and `costoARS` is not reduced, silently producing a wrong cost basis. Worse, if a venta of more nominales than were bought is logged, `prop > 1` and the cost subtraction drives `costoARS` negative. No error or warning is emitted; the corrupted value flows through to PPC and rendimiento calculations.

**Fix:** Clamp `prop` to [0, 1] and emit a Logger warning when overselling is detected:
```javascript
if (nominales > resumen[ticker].nominales) {
  Logger.log("WARN: Venta mayor que nominales para " + ticker);
}
var prop = resumen[ticker].nominales > 0
  ? Math.min(1, nominales / resumen[ticker].nominales) : 0;
```

---

### WR-02: `_getCCLHistorico` fetches the full historical series on every call — multiple times per `completarOperaciones` run

**File:** `apps-script/FinPerso_v12_script.gs:307-335`
**Issue:** `_getCCLHistorico` makes a `UrlFetchApp.fetch` to `api.argentinadatos.com` on **every single call**. `completarOperaciones` calls it once per operation row (line 790 inside the `forEach`). With 50+ operations this is 50+ HTTP calls to the same endpoint. Apart from the `UrlFetchApp` quota concern, this also makes each run slow and brittle: if the API rate-limits, all subsequent CCL lookups in that run fall back to the current day's value, silently assigning the wrong TC to historical operations.

**Fix:** Fetch and cache the full historical dataset once at the start of `completarOperaciones`, then pass it to a pure lookup function:
```javascript
function completarOperaciones() {
  var cclHistData = _fetchCCLHistData(); // one HTTP call
  // ...
  datos.forEach(function(row, i) {
    var tc = _lookupCCL(cclHistData, fecha); // no HTTP call
    // ...
  });
}
```

---

### WR-03: `_parseFecha` does not validate input format — crashes on unexpected date string

**File:** `apps-script/FinPerso_v12_script.gs:1398-1406`
**Issue:** `_parseFecha` assumes a date string is either `dd/mm/yyyy` (slash) or `yyyy-mm-dd` (dash), based solely on whether the string contains `/`. A caller passing an ISO-8601 datetime string (e.g. `"2024-03-15T00:00:00"`) will be parsed incorrectly — the split on `-` produces four parts; `parseInt(p[2])` then parses `"15T00:00:00"` as `15` only by coincidence. Any unexpected format (empty string, `null` passed through, `"03-15-2024"` US format) either throws or silently produces `Invalid Date`, which then propagates as-is into the sheet cell.

**Fix:** Add explicit format detection and throw a descriptive error for unrecognized formats:
```javascript
function _parseFecha(fecha) {
  if (!fecha || typeof fecha !== "string") throw new Error("Fecha inválida: " + fecha);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(fecha)) {
    var p = fecha.split("/");
    return new Date(parseInt(p[2]), parseInt(p[1])-1, parseInt(p[0]));
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    var p = fecha.split("-");
    return new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
  }
  throw new Error("Formato de fecha no reconocido: " + fecha);
}
```

---

### WR-04: `snapshotSemanal` fallback loop skips the closest snapshot before 7 days ago

**File:** `apps-script/FinPerso_v12_script.gs:956-967`
**Issue:** The fallback search for the nearest historical entry (when no exact match for 7 days ago exists) iterates from the end of `datos` backwards and breaks early when `mejorDiff <= 8 * 86400000`. This is logically inconsistent: it breaks as soon as it finds *any* entry within the last 8 days, but because it searches backwards from the most recent entry, the first entry it finds that satisfies `diff > 86400000` (i.e., older than yesterday) may not be the closest to 7 days ago. If the last 3 days all have entries, the loop will break on the 3rd entry (3 days ago) rather than continuing to find the one 7 days ago.

Additionally the condition `diff > 86400000` (strictly older than 1 day) means if the most recent entry is exactly 7 days ago, the exact-match loop above already found it — but if the most recent historical entry is from 2 days ago, the fallback correctly skips it. The break at `<= 8 * 86400000` is intended to stop early but does so unreliably.

**Fix:** Remove the early break and collect all candidates before returning the minimum-diff one, or iterate in ascending order (oldest first) so you naturally arrive at the closest entry before 7 days.

---

### WR-05: `rows` computed in `doGet` is never used

**File:** `apps-script/FinPerso_v12_script.gs:1462`
**Issue:** Line 1462 computes a filtered `rows` array from the data, but the actual loop starting at line 1477 iterates over the raw `data` array instead, re-checking `r[0] !== ""` itself. The filtered `rows` variable is dead code — the duplication means the filter logic is maintained in two places and could drift.

**Fix:** Remove the `rows` variable or use it in the loop:
```javascript
// Remove line 1462 entirely, or replace the for-loop with:
rows.forEach(function(r, ri) { ... });
```

---

### WR-06: `_guardarPrecioAyer` overwrites "precio ayer" with the *current* price — defeats its purpose when called outside `actualizarTodo`

**File:** `apps-script/FinPerso_v12_script.gs:887-893`
**Issue:** `_guardarPrecioAyer` copies column `precio` into `precioAyer`. This is only meaningful if called *before* prices are updated. In `actualizarTodo` the comment on line 1130 says "precioAyer lo escribe actualizarPrecios() con el previousClose de Yahoo" — meaning `_guardarPrecioAyer` is no longer called at all in `actualizarTodo`. The function is effectively dead. If a future developer calls it after `actualizarPrecios`, it overwrites yesterday's price with today's, making daily variation always 0.

**Fix:** Either delete the function (it is never called), or add a prominent comment documenting that it must only be called before `actualizarPrecios`.

---

### WR-07: `_toNum` silently converts values like `"1.234,56"` correctly but discards the integer-dot case

**File:** `apps-script/FinPerso_v12_script.gs:66-70`
**Issue:** The logic for detecting European vs. US number formatting is:
1. If both `.` and `,` exist → European format → strip dots, replace comma with dot.
2. If only `,` → replace comma with dot.
3. Otherwise → parse as-is.

A value like `"1.234"` (European thousands with no decimal) falls into branch 3 and is parsed as `1.234` (US float) instead of `1234`. In the Argentinian market context, prices like `1.234` (one thousand two hundred thirty-four pesos) are routinely formatted with a dot as thousands separator. This produces silently wrong nominal prices.

**Fix:** Detect European thousands by checking if the dot appears in groups of 3 digits without a subsequent comma:
```javascript
// If the string matches European thousand-separator pattern (dot every 3 digits, no trailing decimals after comma):
if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
  s = s.replace(/\./g, "").replace(",", ".");
}
```

---

## Info

### IN-01: `_getMEPHistorico` is marked as kept for compatibility but is never called

**File:** `apps-script/FinPerso_v12_script.gs:338`
**Issue:** The comment at line 337 says "Mantenemos _getMEPHistorico por compatibilidad pero ya no se usa para operaciones." A search confirms it is never called anywhere in the file. Dead code adds maintenance burden and confusion.

**Fix:** Remove the function, or if backward compatibility with external callers is a concern, add a `@deprecated` JSDoc.

---

### IN-02: `configurarTriggers` deletes ALL project triggers before recreating them

**File:** `apps-script/FinPerso_v12_script.gs:1143-1144`
**Issue:** Line 1144 deletes every trigger on the project, including any manually created ones. If a user or future developer adds a custom trigger and then re-runs `configurarTriggers`, that custom trigger is silently deleted with no warning.

**Fix:** Either document this behavior prominently in a comment/README, or only delete the triggers that will be replaced (by comparing function names).

---

### IN-03: Magic fallback exchange rate `1400` is hardcoded

**File:** `apps-script/FinPerso_v12_script.gs:122`
**Issue:** The fallback TC `1400` (line 122) will become stale as the ARS/USD rate moves. When the API is unreachable and no stored value is available, all USD conversions silently use this constant, producing incorrect portfolio valuations with no user-visible warning.

**Fix:** Store the fallback in `CONFIG` with a clearly named constant and document that it must be updated periodically, or better, read it from the `Valores` sheet so it can be updated without a code deploy:
```javascript
var FALLBACK_TC = CONFIG.fallbackTC || 1400; // set CONFIG.fallbackTC from Valores
```

---

### IN-04: `doGet` `Benchmark` branch uses `encodeURIComponent` but the sheet-data branch does not sanitize `sheet` parameter

**File:** `apps-script/FinPerso_v12_script.gs:1439, 1455-1459`
**Issue:** In the `Benchmark` branch, `symbol` is passed through `encodeURIComponent` before being appended to the Yahoo URL. But the `sheet` parameter in the non-Benchmark branch is used directly as a sheet name lookup, which is safe in Apps Script (no injection risk since `getSheetByName` is not an eval). However without an allowlist (see CR-01), any sheet name is accepted. This is documented under CR-01; this info item notes the inconsistency in how the two parameters are treated.

**Fix:** See CR-01 fix (allowlist). No additional sanitization needed beyond that.

---

_Reviewed: 2026-04-27T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
