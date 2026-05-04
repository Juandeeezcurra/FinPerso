# Auditoria FinPerso

Fecha: 2026-05-03  
Alcance: frontend `index.html`, PWA/manifest, Apps Script backend, estructura del repo y docs.

## Resumen ejecutivo

FinPerso esta bien encaminado para una app personal: el flujo principal esta claro, el stack es simple y el modelo Google Sheets + Apps Script tiene sentido para el uso. La deuda mas importante no es visual ni de calculo; esta en seguridad de frontend/API y mantenibilidad.

Los riesgos principales son:

- El backend tiene soporte de token opcional, pero el frontend no envia token.
- La app renderiza datos de Google Sheets con `innerHTML`, lo que abre XSS persistente.
- Hay handlers inline con datos dinamicos (`onclick`) que agrandan esa superficie.
- El HTML principal concentra demasiadas responsabilidades en un solo archivo.
- Hay duplicacion/archivos legacy que conviene mantener separados del deploy real.

## Hallazgos prioritarios

### Critico: autenticacion incompleta entre frontend y Apps Script

El Apps Script documenta y valida `API_TOKEN` si existe en Script Properties, pero `index.html` no envia token ni en GET ni en POST.

Impacto:

- Si se configura `API_TOKEN`, la app queda sin poder leer/escribir.
- Si no se configura, la API queda abierta para cualquiera que conozca la URL del Web App.
- `Valores` esta en `ALLOWED_SHEETS` y el frontend la consulta, exponiendo email/configuracion.

Referencias:

- `apps-script/FinPerso_v12_script.gs:60`
- `apps-script/FinPerso_v12_script.gs:1282`
- `apps-script/FinPerso_v12_script.gs:1561`
- `index.html:1692`
- `index.html:1698`

Recomendacion:

Agregar un campo de token en setup, guardar `api_url` + `api_token`, y centralizar todas las llamadas en helpers:

- GET: `API_URL + '?sheet=Portfolio&token=' + encodeURIComponent(API_TOKEN)`
- POST: incluir `{ token: API_TOKEN, ...payload }`

Despues de eso, hacer que el token sea obligatorio en Apps Script para produccion.

### Critico: XSS persistente desde Google Sheets

Valores provenientes de Sheets se interpolan dentro de `innerHTML`: nombres, tickers, tipos, notas, leyendas, heatmap, opciones de datalist.

Impacto:

Una celda con HTML/JS malicioso podria ejecutar codigo en el navegador de cualquiera que abra la app. Como la app maneja URL del Apps Script, email y datos financieros, el riesgo es alto.

Referencias:

- `index.html:1795`
- `index.html:1910`
- `index.html:1952`
- `index.html:2049`
- `index.html:2088`
- `index.html:2138`
- `index.html:2576`
- `index.html:2616`
- `index.html:2669`

Recomendacion:

Primero parche rapido con helper `esc()` en todo dato de Sheets que entre a HTML. Luego migrar renderers criticos a DOM seguro con `createElement` y `textContent`.

### Alto: datos dinamicos dentro de `onclick`

Hay tickers y tipos insertados dentro de atributos `onclick`. Esto permite romper el string del handler si entra una comilla maliciosa desde Sheets.

Referencias:

- `index.html:1795`
- `index.html:1905`
- `index.html:1907`

Recomendacion:

Reemplazar por `data-*` y event delegation. Ejemplo: `data-action="edit-price"` y `data-ticker="MELI"`.

### Alto: URL de API no se revalida al leer localStorage

La URL se valida al guardar, pero al iniciar se carga cualquier valor existente en `localStorage`.

Referencia:

- `index.html:1611`

Recomendacion:

Aplicar la misma validacion en `init()` y, si falla, limpiar la config y volver al setup.

### Alto: dependencias externas sin SRI ni CSP

Chart.js se carga desde CDN sin `integrity`, y no hay Content Security Policy.

Referencias:

- `index.html:13`
- `index.html:14`

Recomendacion:

Agregar SRI y `crossorigin`. La CSP estricta conviene dejarla para despues de eliminar `onclick` inline y reducir `innerHTML`.

### Medio: updates optimistas sin rollback

Editar precio o cash actualiza UI antes de confirmar servidor. Si el POST falla, se alerta pero la UI queda con datos temporariamente falsos.

Referencias:

- `index.html:2825`
- `index.html:2851`

Recomendacion:

Guardar valor previo, revertir en error, y/o no cerrar modal hasta confirmar.

### Medio: PWA incompleta

Hay manifest e iconos, pero no service worker. Esto no es necesariamente malo para una app financiera, pero deberia quedar documentado como decision: installable sin cache offline de datos sensibles.

Referencias:

- `manifest.json`
- `index.html:12`

Recomendacion:

Definir politica explicita. Si se agrega service worker, cachear solo shell/assets, nunca respuestas de Apps Script con datos financieros.

### Medio: monolito HTML dificil de mantener

`index.html` tiene casi 3000 lineas con CSS, HTML, fetch, estado, render, charts y formularios.

Recomendacion:

Sin cambiar de framework, extraer progresivamente:

- `api` helper: token, URL, GET/POST, errores.
- helpers seguros: `esc`, `el`, render de texto.
- renderers por seccion: portfolio, operaciones, efectivo, resumen.
- estilos a `assets/` si el hosting lo permite.

### Bajo: duplicacion y legacy

Habia archivos historicos en raiz junto a la app actual. Se movieron a `legacy/` para separar el deploy real de snapshots anteriores.

## Orden recomendado de trabajo

1. Implementar token real en frontend + Apps Script obligatorio.
2. Parchear XSS con `esc()` en todos los renders.
3. Reemplazar `onclick` dinamicos por event delegation.
4. Revalidar URL de API desde `localStorage`.
5. Agregar SRI a Chart.js.
6. Agregar rollback en updates optimistas.
7. Modularizar `index.html` por capas.
8. Definir politica PWA/offline.

## Estado del repo al auditar

Cambios locales no relacionados con la app:

- `.claude/settings.local.json`
- `.claude/settings.json`

No fueron incluidos en esta auditoria funcional.
