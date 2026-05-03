---
name: finperso
description: Contexto completo del proyecto FinPerso de Juan de Ezcurra — tracker de inversiones personales construido en Google Sheets + Apps Script + dashboard HTML. Usar este skill SIEMPRE que Juan mencione FinPerso, su portfolio, sus inversiones, el script de Google, el dashboard, tickers, reportes de portfolio, o pida mejoras al código del tracker. También usar cuando pida generar archivos (Excel, PDF, Word) con datos de su portfolio.
---

# FinPerso — Skill de Contexto

## Qué es FinPerso

Tracker de inversiones personales de Juan de Ezcurra. Sistema compuesto por:

- **Google Sheets**: base de datos central (operaciones, portfolio, historial, tickers, valores, efectivo).
- **Google Apps Script** (`apps-script/FinPerso_v12_script.gs`): motor de lógica, fetch de precios, cálculos USD, reporte diario por email, API REST para el dashboard.
- **Dashboard HTML** (`index.html` + `export/FinPerso.html`): frontend visual standalone que consume la API del script vía `doGet`/`doPost`.

Versión actual: **v12**. El eje del cambio reciente es usar **CCL (Contado con Liqui)** como tipo de cambio único para toda valuación en USD — histórico en operaciones, actual en valuación — reemplazando al MEP.

---

## Instrumentos en cartera

| Tipo | Características clave |
|---|---|
| **CEDEARs / Equity ARS** | Cotizan en ARS pero muchos representan acciones extranjeras. Valuación USD vía CCL. |
| **Acciones locales (BYMA)** | Cotizan en ARS. Empresas argentinas. |
| **Bonos / LECAPs** | Renta fija. LECAPs con TEM; bonos con TIR. |
| **Crypto** | Cotización en USD. Alta volatilidad. |
| **Cash** | ARS y USD como "posiciones" con saldo derivado. |

**Lógica de moneda**: la columna `Moneda` de cada ticker (ARS/USD) es la fuente de verdad. El script NO infiere moneda por tipo de instrumento — si un CEDEAR está marcado como ARS, se trata como ARS y se convierte con CCL.

---

## Estructura del Google Sheet

Definidas en `CONFIG.hojas` del script:

### `Operaciones`
Historial de compras/ventas. Columnas:
```
Fecha | Orden | Ticker | Nombre | Tipo | Moneda | Nominales | Precio | Precio USD | TC | Total ARS | Total USD
```
- `TC` se completa automáticamente con `_getCCLHistorico(fecha)` (no MEP).
- `onEdit` y `completarOperaciones()` rellenan TC, Precio USD, Total ARS/USD.

### `Portfolio`
Posiciones agregadas (recalculadas, no se edita a mano). Columnas:
```
Ticker | Nombre | Moneda | Tipo | Nominales | Precio | DPT | PPC | PPC USD |
Rend. ARS | Rend. USD | % Portfolio | Total ARS | Total USD | Precio Ayer | Precio Sem Anterior
```
- Incluye filas `ARS` y `USD` como posiciones de cash (pueden ser negativas).
- `DPT` = días promedio de tenencia ponderado por costo.
- `PPC USD` se calcula con CCL histórico del día de la compra.

### `Historial`
Snapshot diario del portfolio total. Columnas:
```
Fecha | Total ARS | Total USD | Var. Diaria | Var. Semanal | CCL
```
La columna `CCL` guarda el CCL del día para auditoría y para calcular variación diaria USD de instrumentos ARS (convirtiendo precio_hoy/CCL_hoy vs precio_ayer/CCL_ayer).

### `Tickers`
Configuración de instrumentos. Columnas:
```
Ticker | Nombre | Yahoo Symbol | Online | Emoji | Precio Manual
```
- `Online = "Sí"` → se actualiza vía Yahoo Finance (`TICKER.BA`).
- `Online = "No"` → usa `Precio Manual` de la columna 6.
- `_registrarTickers()` auto-registra tickers nuevos que aparecen en Operaciones e intenta resolverlos con Yahoo.

### `Valores`
Key-value store. Claves: `Fecha Update`, `Email reporte`, `Dolar MEP`, `Dolar CCL`, `Total ARS`, `Total USD`.

### `Efectivo`
Movimientos manuales de cash (depósitos/extracciones). Columnas:
```
Fecha | Tipo | Moneda | Monto | Nota
```
Junto con las compras/ventas de Operaciones, alimenta `_computeCashBalance(moneda)` que deriva el saldo de cash ARS/USD que aparece en Portfolio.

---

## Apps Script — Funciones reales

### Actualización de datos
- `actualizarDolar()` — pega a `dolarapi.com`, actualiza MEP y CCL en `Valores`.
- `_getCCLHistorico(fecha)` — pega a `argentinadatos.com`, devuelve CCL del día exacto o anterior más cercano. **Fuente única para valuación USD en operaciones.**
- `_getPrecioYahoo(symbol)` — devuelve `{precio, previousClose}`. Tiene lógica robusta: si `regularMarketPrice` coincide con el último close del historial, usa el penúltimo como `previousClose` (protege contra latencia variable de Yahoo entre meta y chart).
- `actualizarPrecios()` — actualiza precios del Portfolio desde Yahoo (tickers online) o precio manual (offline).

### Núcleo de cálculo
- `recalcularPortfolio()` — reconstruye la hoja Portfolio desde Operaciones + Efectivo. Calcula PPC, DPT, rendimientos ARS/USD, % del portfolio y saldos de cash.
- `completarOperaciones()` — completa filas incompletas (TC, Precio USD, totales). Llamada por trigger cada 10 min.
- `onEdit(e)` — al editar una fila de Operaciones, completa los campos derivados y recalcula Portfolio.

### Historial / snapshots
- `_guardarSnapshotDiario()` — appendea fila al Historial con Total ARS/USD, variación diaria en USD y CCL del día.
- `_guardarPrecioAyer()` — copia `Precio` → `Precio Ayer` (llamada por trigger diario).
- `_guardarPrecioSemanal()` / `snapshotSemanal()` — análogo semanal, los viernes.

### Reporte por email
- `enviarReporteDiario()` — L-V 17hs. HTML con yield del día, CCL, cash total, Top Gainer/Loser y tabla de posiciones. La variación diaria USD para instrumentos ARS se calcula con CCL de hoy y CCL de ayer (del Historial), no con un único CCL.

### Master
- `actualizarTodo()` — corre el pipeline completo: dólar → precios → completar ops → recalcular → reporte → snapshot. Los viernes también snapshot semanal.

### API REST (para el dashboard HTML)
- `doGet(e)` — sirve las hojas como JSON. Parámetros:
  - `?sheet=Portfolio|Operaciones|Historial|Tickers|Valores|Efectivo`
  - `?sheet=Benchmark&symbol=SPY` → devuelve 180 días de cierres desde Yahoo.
- `doPost(e)` — acciones mutables. `action` soporta:
  - `updateEmail`, `deleteOp`, `editOp`, `updateNominalesCash`,
  - `addEfectivo`, `deleteEfectivo`, `updatePrecioManual`,
  - default (sin `action`) → alta de operación nueva.

### NO existe en el código (aunque versiones de la skill lo sugerían)
- ❌ No hay llamadas a la API de Claude. No hay `generarEmojiTicker()` con Haiku ni `generarAnalisisMacro()` con Sonnet.
- ❌ No hay integración con AppSheet en el script actual.

### Triggers configurados (`configurarTriggers()`)
- `actualizarTodo` — L-V 17hs.
- `actualizarDolar` — L-V 11hs y 14hs.
- `completarOperaciones` — cada 10 min.
- `actualizarPrecios` — cada 30 min.

---

## Dashboard HTML

- `index.html` es el dashboard activo; `export/FinPerso.html` es un snapshot/export.
- Consume la API del Apps Script (Web App) vía `doGet`/`doPost`.
- Muestra: totales ARS/USD, distribución por tipo, posiciones con variación diaria y rendimiento, widget de cash, widget de TC, widget de email, movimientos de efectivo, benchmark contra índices.
- Sidebar fijo en desktop (`position: fixed`); en mobile el Top Gainer/Loser ocupa ancho completo.
- Modales custom para alta/edición de operaciones y efectivo.
- Favicon e íconos inline en base64.

---

## Convenciones y preferencias de Juan

### Al trabajar en el código
- **Entregar siempre el archivo completo actualizado** cuando el cambio es estructural. Para fixes puntuales, un diff chico está bien.
- Código limpio, comentarios en español cuando aclaren el *por qué* (no el *qué*).
- Respetar `CONFIG` y los nombres de hoja existentes. No inventar hojas nuevas sin pedirlo.
- Cualquier cálculo en USD debe partir del CCL correspondiente (histórico para operaciones, actual para valuación).
- No introducir llamadas a APIs externas nuevas sin confirmarlo — el sistema depende de disponibilidad de dolarapi, argentinadatos y Yahoo.

### Al generar archivos (Excel, PDF, Word)
- Separar por tipo de instrumento.
- Mostrar ARS y USD en paralelo cuando aplique.
- Variaciones con color (verde positivo / rojo negativo).
- Header con fecha/hora de generación y CCL de referencia.
- Estilo profesional, sin exceso decorativo.

### Al analizar el portfolio
- Contexto macro argentino siempre: CCL, inflación, BCRA, riesgo país.
- CEDEARs analizados vía CCL implícito.
- LECAPs contra TEM de referencia.
- Alertar si un instrumento supera 30% del portfolio.

---

## Token budget / eficiencia

- El script completo pesa ~1500 líneas. **No releerlo entero** si ya está en contexto o si el cambio es puntual — usar Grep para ubicar funciones específicas.
- El `index.html` también es grande; leer por rangos.

---

## Cómo usar este skill

1. **Leer este skill primero** — no pedir contexto que ya está acá.
2. **Inferir la estructura** antes de preguntar por columnas obvias.
3. **Para código**: si es estructural, archivo completo; si es fix, diff puntual.
4. **Para análisis**: incluir contexto macro argentino y CCL.
5. **Antes de afirmar que una función existe**: grep el script — las versiones anteriores de esta skill mencionaban funciones que nunca estuvieron en el código.
