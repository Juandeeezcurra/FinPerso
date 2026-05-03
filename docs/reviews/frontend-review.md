---
phase: adhoc-html
reviewed: 2026-04-27T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - index.html
findings:
  critical: 4
  warning: 6
  info: 4
  total: 14
status: issues_found
---

# Code Review: index.html

**Reviewed:** 2026-04-27
**Depth:** standard
**Files Reviewed:** 1 (index.html — 2801 lines, single-file GAS web app frontend)
**Status:** issues_found

## Summary

The file is a well-structured single-page application with sections for portfolio summary, positions, operations, and cash management. The frontend communicates with a Google Apps Script backend via `fetch`.

The most serious findings are XSS vulnerabilities: server-supplied data (asset names, tickers, asset types, notes) is interpolated directly into `innerHTML` strings without sanitization. A malicious or corrupted Google Sheets entry could inject arbitrary HTML/JavaScript into all users of the shared app. There are also logic bugs in the squarified treemap algorithm, a stored URL injected without re-validation, and missing validation on the email field.

---

## Critical Issues

### CR-01: XSS — Server data injected unsanitized into innerHTML (multiple locations)

**File:** `index.html:1872, 1916-1920, 2013, 2467-2471, 2507-2513, 2560`

**Issue:** Values retrieved from the Google Sheets backend — `p['Nombre']`, `p['Ticker']`, `p['Tipo']`, `o['Nombre']`, `o['Ticker']`, `r['Nota']`, `r['Tipo']`, `item.ticker`, `item.nombre` — are interpolated directly into template literals assigned to `innerHTML`. A spreadsheet cell containing `<img src=x onerror=alert(1)>` or any script tag would execute in every user's browser. Because the app is shared with friends, a single compromised or incorrectly-formatted cell affects all users simultaneously.

Representative locations:

- Line 1872: `Activo` cell — `${p['Nombre']||p['Ticker']}` and `${p['Ticker']}` inside `<td>` via `innerHTML`
- Lines 1916–1920: Operaciones table — `${o['Nombre']||o['Ticker']||''}`, `${o['Ticker']||''}`, `${moneda}`, `${o['Orden']||''}`
- Line 2013: `mkSplit` hero metric — `${p['Nombre']||p['Ticker']}` injected into `metrics-row` innerHTML
- Lines 2467–2471: Heatmap nodes — `${item.ticker}` assigned to `node.innerHTML`
- Lines 2507–2513: Efectivo table — `${r['Nota']||''}`, `${r['Tipo']||''}`, `${r['Moneda']||''}`
- Line 2560: Ticker datalist — `${tickerNombres[t]}` in `<option>` via `innerHTML`

**Fix:** Either escape all server-supplied strings before injecting into HTML, or switch to DOM APIs (`textContent`, `createElement`/`appendChild`) for data fields. A minimal helper:

```javascript
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

Then replace every `${p['Nombre']||p['Ticker']}` inside template literals bound to `innerHTML` with `${esc(p['Nombre']||p['Ticker'])}`, etc.

---

### CR-02: XSS — Server Tipo field injected into onclick attribute (filter bar)

**File:** `index.html:1802`

**Issue:** The `Tipo` column value from each portfolio row is interpolated into an `onclick` attribute string inside `innerHTML`:

```javascript
document.getElementById('filter-bar').innerHTML = tipos.map(t =>
  `<span class="filter-chip ${t===activeFilter?'active':''}" onclick="setFilter('${t}')">${t}</span>`
).join('');
```

A `Tipo` value containing a single-quote and closing parenthesis — e.g. `');alert(document.cookie);//` — breaks out of the string literal and executes arbitrary JavaScript. This is a classic HTML injection into event handler context, distinct from the innerHTML text-content issue in CR-01.

**Fix:** Avoid injecting server data into `onclick` strings entirely. Use `data-*` attributes and delegate events:

```javascript
document.getElementById('filter-bar').innerHTML = tipos.map(t =>
  `<span class="filter-chip ${t===activeFilter?'active':''}" data-tipo="${esc(t)}">${esc(t)}</span>`
).join('');
document.getElementById('filter-bar').addEventListener('click', e => {
  const chip = e.target.closest('[data-tipo]');
  if (chip) setFilter(chip.dataset.tipo);
});
```

---

### CR-03: Stored API URL loaded from localStorage without re-validation

**File:** `index.html:1614-1615`

**Issue:** On startup, the previously saved Apps Script URL is loaded from `localStorage` and used unconditionally without re-validating the `https://script.google.com/macros/s/` prefix:

```javascript
function init(){
  const s = localStorage.getItem(STORAGE_KEY);
  if(s){ API_URL = s; mostrarApp(); }   // no validation
  ...
}
```

`guardarConfig()` validates the URL on initial save (line 1641), but `localStorage` can be modified by other scripts running on the same origin (e.g., via a third-party CDN compromise) or by users opening DevTools. A manipulated `API_URL` would redirect all fetch calls to an attacker-controlled endpoint, which could then return a crafted response containing HTML/JS that is rendered via `innerHTML` (see CR-01), leading to XSS.

**Fix:** Re-apply the prefix check on load:

```javascript
const s = localStorage.getItem(STORAGE_KEY);
if(s && s.startsWith('https://script.google.com/macros/s/')){
  API_URL = s; mostrarApp();
} else {
  document.getElementById('setup-screen').style.display = 'flex';
}
```

---

### CR-04: Ticker value injected into onclick attribute of edit buttons

**File:** `index.html:1867-1869`

**Issue:** `p['Ticker']` from the server is interpolated into the `onclick` attribute of `<button>` elements:

```javascript
editBtn = ` <button class="price-edit-btn" onclick="editarNominalesCash('${p['Ticker']}',${toN(p['Nominales'])})" ...>✎</button>`;
editBtn = ` <button class="price-edit-btn" onclick="editarPrecio('${p['Ticker']}',${toN(p['Precio'])})" ...>✎</button>`;
```

A Ticker value like `');alert(1);//` would break out of the string literal in the event handler and execute arbitrary code. While the Ticker field is expected to be a short symbol, it comes from Google Sheets and is not sanitized.

**Fix:** Use `data-*` attributes and a delegated listener, or at minimum escape the ticker with `esc()` before placing it in the attribute (though the correct fix is to avoid event handler attributes altogether):

```javascript
editBtn = ` <button class="price-edit-btn" data-ticker="${esc(p['Ticker'])}" data-nominales="${toN(p['Nominales'])}" data-action="editCash" ...>✎</button>`;
// In tbody, attach a delegated click listener that reads dataset.ticker
```

---

## Warnings

### WR-01: No Subresource Integrity (SRI) on external CDN script

**File:** `index.html:13`

**Issue:** Chart.js is loaded from Cloudflare CDN without an `integrity` attribute:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
```

If the CDN is compromised or serves a tampered file, arbitrary JavaScript would execute in users' browsers with full access to the DOM and `localStorage` (which holds the API URL and email).

**Fix:** Add the SRI hash:

```html
<script
  src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"
  integrity="sha512-ZnR2pBm5bkHk7iNvCj9hChEAWVlNtT5K1wCLCKgimHq/5bIXQ0dP7gTST35l7RbCVF6wGzH26gAx2W+2Nbzpg=="
  crossorigin="anonymous"
  referrerpolicy="no-referrer">
</script>
```

(Obtain the correct hash from the Cloudflare SRI checker or cdnjs.com for the exact version.)

---

### WR-02: layoutStrip — dead assignment on first rect in vertical strips

**File:** `index.html:2358-2361`

**Issue:** In the vertical branch of the strip layout loop, the first `item.rect` assignment is immediately overwritten:

```javascript
if(vertical){
  item.rect = {x: x+offset*0, y: y, w: stripSize, h: itemSize};  // dead, immediately overwritten
  // Actually place along the short side
  item.rect = {x: x, y: y+offset, w: stripSize, h: itemSize};    // this one is used
}
```

The first line (`x+offset*0` is just `x`) assigns a `rect` that is never read. The comment `// Actually place along the short side` confirms this was a mistake mid-edit. While the treemap still renders correctly due to the second assignment, this leaves misleading dead code and suggests the algorithm went through an incomplete rewrite. If `offset` were ever used in the first assignment without the `*0` factor, items would render at wrong positions.

**Fix:** Remove the dead line:

```javascript
if(vertical){
  item.rect = {x: x, y: y+offset, w: stripSize, h: itemSize};
}
```

---

### WR-03: `enviarQuickOp` override pattern is fragile — double-submit possible

**File:** `index.html:2762-2781`

**Issue:** The edit-operation flow works by reassigning the global `enviarQuickOp` at runtime after capturing the original in `_origEnviarQuickOp`. The submit button in HTML uses `onclick="enviarQuickOp()"` (line 1482). If `enviarQuickOp` is reassigned again (e.g., during hot-reload, future refactor, or a second call to the override block), `_origEnviarQuickOp` would point to the already-wrapped version, creating a chain of nested wrappers and potentially submitting the same operation multiple times.

Additionally, the `btn.disabled=true` guard at line 2773 is only set after validation passes — a double-click before the `await` resolves could pass validation twice and fire two POST requests.

**Fix:** Use a single function with explicit state branching (`editingFila !== null`) rather than runtime function reassignment. For the double-click issue, disable the button immediately on entry before validation:

```javascript
async function enviarQuickOp(){
  const btn = document.getElementById('qop-submit');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    if(editingFila) { await _doEditOp(); }
    else            { await _doNewOp();  }
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}
```

---

### WR-04: Email field accepts any non-empty string — no format validation

**File:** `index.html:1654-1665`

**Issue:** `guardarEmail()` only checks that the trimmed value is non-empty (`if(!email)`). It does not validate that the value is a properly formatted email address before sending it to the backend. The `<input type="email">` HTML attribute provides browser-side format hints but does not block programmatic submission (e.g., via Enter key in other fields or `guardarEmail()` called from script). An arbitrary string is sent to `updateEmail` on the Apps Script backend.

**Fix:** Add a basic format check:

```javascript
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if(!email || !emailRe.test(email)){
  status.textContent = 'Ingresá un email válido.';
  ...
  return;
}
```

---

### WR-05: Optimistic update on price/cash edit is not rolled back on server error

**File:** `index.html:2715-2727, 2742-2752`

**Issue:** Both `confirmarPrecio()` and `confirmarCash()` apply an optimistic UI update (mutate local `portfolio` array and re-render) before the `fetch()` call completes. If the server returns `data.error`, the code calls `alert('Error: ...')` but does not revert the local portfolio state. The UI shows the wrong price/balance until the next full `cargarDatos()` reload, which requires user action (or the background timer).

```javascript
// confirmarPrecio — line 2718
portfolio.forEach(p => { if(p['Ticker']===ticker){ p['Precio']=precio; }});
renderPortfolio(); renderResumen();
closeMiniPrecio();                  // modal already closed
fetch(...)
  .then(r=>r.json()).then(data=>{
    if(data.error) alert('Error: '+data.error);  // UI state already wrong, not reverted
    else setTimeout(()=>cargarDatos(),1000);
  });
```

**Fix:** Save the previous value before mutation and restore it on error:

```javascript
const prev = {};
portfolio.forEach(p => { if(p['Ticker']===ticker){ prev.precio=p['Precio']; p['Precio']=precio; }});
renderPortfolio(); renderResumen();
closeMiniPrecio();
fetch(...)
  .then(r=>r.json()).then(data=>{
    if(data.error){
      portfolio.forEach(p => { if(p['Ticker']===ticker) p['Precio']=prev.precio; });
      renderPortfolio(); renderResumen();
      alert('Error: '+data.error);
    } else {
      setTimeout(()=>cargarDatos(),1000);
    }
  });
```

---

### WR-06: `confirmarInlineCash` hides error element before fetch, shows errors on wrong element

**File:** `index.html:1771-1779`

**Issue:** In `confirmarInlineCash`, after a successful value parse, the code:
1. Hides the display span, shows the input, updates local state, and re-renders — all before the fetch completes.
2. On fetch error, it tries to re-show the confirm button and input. But by this point `cancelarEdicionCash()` may have been called by the user for the other currency (ARS vs USD are edited simultaneously), leaving inconsistent UI state for the error-currency.

Additionally, if the user confirms ARS, then immediately confirms USD before the ARS fetch returns, both fetches run concurrently on the same portfolio object mutation path — the second fetch may overwrite what the first set.

**Fix:** Disable both confirm buttons for the duration of any in-flight fetch, and re-enable them (or call `cancelarEdicionCash()`) unconditionally in both the success and error paths:

```javascript
async function confirmarInlineCash(moneda){
  ['ARS','USD'].forEach(m => {
    document.getElementById('cash-'+m.toLowerCase()+'-confirm').disabled = true;
  });
  // ... existing logic ...
  // In finally block:
  ['ARS','USD'].forEach(m => {
    document.getElementById('cash-'+m.toLowerCase()+'-confirm').disabled = false;
  });
}
```

---

## Info

### IN-01: `isQuickCash()` always returns false — dead branch in `toggleQuickFields`

**File:** `index.html:2579-2597`

**Issue:** `isQuickCash()` is hardcoded to `return false`. Inside `toggleQuickFields()`, the variable `c` is set to `false` (not even calling `isQuickCash()`), and the `if(c)` block (lines 2588-2593) is permanently dead code. The same pattern is repeated in `enviarQuickOp` (line 2632) and the edit override (line 2768), where `c=isQuickCash()` is read but the `if(c)` branches cannot execute.

This suggests a Cash operation mode was partially removed but the scaffolding was left in place. The dead code increases maintenance burden.

**Fix:** Remove the `isQuickCash` function, the `const c=isQuickCash()/const c=false` local variables, and the unreachable `if(c){...}` blocks throughout `toggleQuickFields`, `enviarQuickOp`, and the `enviarQuickOp` override.

---

### IN-02: `recentOps` is populated and persisted to localStorage but never read

**File:** `index.html:2558, 2643`

**Issue:** `recentOps` is deserialized from `localStorage` on load and populated after each new operation save (line 2643), but no code in the file reads or displays it. It is pure write-only state. This wastes a `localStorage.setItem` call on every saved operation and leaves misleading code suggesting a "recent operations" feature exists.

**Fix:** Remove the `recentOps` variable, the `localStorage.getItem('portfolio_recent_ops')` initialization, and the `recentOps.unshift(...)` / `localStorage.setItem('portfolio_recent_ops',...)` block in the success handler.

---

### IN-03: `runSum` variable declared but never used inside `layoutStrip`

**File:** `index.html:2340`

**Issue:** Inside the strip-sizing loop in `layoutStrip`, `let runSum=0` is declared but `runSum` is never assigned or read:

```javascript
let strip=[], stripSum=0;
let bestRatio=Infinity;
let splitIdx=0;
...
let runSum=0;   // declared, never used
for(const s of strip){ ... }
```

**Fix:** Delete the `let runSum=0;` line.

---

### IN-04: No Content Security Policy defined

**File:** `index.html` (head section, lines 1-20)

**Issue:** The page has no `Content-Security-Policy` meta tag. Given that the app renders server-supplied data into the DOM (and currently does so unsanitized in several places — see CR-01/CR-02/CR-04), a CSP would provide meaningful defense-in-depth. Without it, any XSS that executes has full access to inline script, external resources, and `localStorage`.

**Fix:** After fixing the innerHTML/sanitization issues (CR-01 through CR-04), add a meta CSP that restricts script execution to known origins:

```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self';
           script-src 'nonce-RANDOM' https://cdnjs.cloudflare.com;
           style-src 'self' https://fonts.googleapis.com;
           font-src https://fonts.gstatic.com;
           connect-src https://script.google.com https://fonts.googleapis.com;">
```

Note: Inline event handlers (`onclick=...` attributes in HTML and dynamically built innerHTML) are incompatible with a strict `script-src` CSP, which is another reason to migrate those patterns first.

---

_Reviewed: 2026-04-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
