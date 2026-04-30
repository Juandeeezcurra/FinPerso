# Bug: Variación diaria del reporte muestra valores incorrectos

## Problema

El reporte diario por mail muestra variaciones diarias que no coinciden con la realidad. Ejemplo: MELI bajó -2.3% en USD, el reporte muestra -3%.

## Causa raíz identificada

El campo `precioAyer` (columna O de Portfolio) no refleja el **cierre real** del día anterior. Refleja el `regularMarketPrice` que Yahoo Finance devolvió a las 17hs, que puede ser un precio intraday (el mercado BYMA cierra entre 17:00-17:15 y el precio tarda en consolidarse).

La función `_getPrecioYahoo()` usa `meta.regularMarketPrice || meta.previousClose`, y durante el horario de mercado `regularMarketPrice` es el precio en tiempo real, no el cierre.

Después de enviar el reporte, `_guardarPrecioAyer()` pisa el valor con el precio actual, así que el precio incorrecto que usó el reporte ya no es visible para debugging.

## Archivos a modificar

Solo el **Google Apps Script** (`Google_Script__current__` en el proyecto Claude, o el código en el editor de Apps Script del usuario).

**NO tocar el HTML del dashboard.**

## Cambios requeridos

### 1. Modificar `_getPrecioYahoo` para devolver también el `previousClose`

Cambiar la función para que devuelva un objeto con ambos valores en vez de solo un número:

```javascript
// ANTES:
function _getPrecioYahoo(symbol) {
  // ...
  return meta.regularMarketPrice || meta.previousClose || null;
}

// DESPUÉS:
function _getPrecioYahoo(symbol) {
  // ...
  return {
    precio: meta.regularMarketPrice || meta.previousClose || null,
    previousClose: meta.previousClose || null
  };
}
```

### 2. Actualizar TODOS los llamadores de `_getPrecioYahoo`

Hay 2 lugares que llaman a `_getPrecioYahoo`:

- **`_intentarYahoo()`** — usa el resultado para verificar si el ticker cotiza. Adaptar para usar `.precio`.
- **`actualizarPrecios()`** — usa el resultado para escribir el precio actual en Portfolio. Adaptar para usar `.precio`.

### 3. Guardar `previousClose` como `precioAyer`

En `actualizarPrecios()`, además de escribir el precio actual en la columna Precio (col 6), escribir el `previousClose` en la columna Precio Ayer (col 15). Esto garantiza que `precioAyer` siempre sea el cierre real del día anterior según Yahoo, no un precio intraday capturado a una hora arbitraria.

```javascript
// En actualizarPrecios(), después de obtener los precios:
if (t && precios[t]) {
  port.getRange(CONFIG.filaInicio + i, CONFIG.colPrecio).setValue(precios[t].precio);
  // Guardar previousClose como precioAyer directamente desde Yahoo
  if (precios[t].previousClose) {
    port.getRange(CONFIG.filaInicio + i, CONFIG.port.precioAyer).setValue(precios[t].previousClose);
  }
}
```

### 4. Eliminar `_guardarPrecioAyer()` de `actualizarTodo()`

Ya no es necesario copiar precio → precioAyer al final del ciclo, porque `actualizarPrecios()` escribe el `previousClose` directo de Yahoo. Esto elimina el problema de raíz: el precio de ayer siempre es el cierre oficial, no un snapshot de un momento arbitrario.

```javascript
// ANTES:
function actualizarTodo() {
  actualizarDolar();
  actualizarPrecios();
  completarOperaciones();
  recalcularPortfolio();
  enviarReporteDiario();
  _guardarSnapshotDiario();
  _guardarPrecioAyer();        // ← ELIMINAR esta línea
  var dia = new Date().getDay();
  if (dia === 5) {
    _guardarPrecioSemanal();
    snapshotSemanal();
  }
}
```

### 5. NO eliminar la función `_guardarPrecioAyer()`

Dejar la función definida por si se necesita en el futuro, pero sacarla de `actualizarTodo()`.

### 6. Mismo tratamiento para `precioSemAnt` (columna P)

Evaluar si `_guardarPrecioSemanal()` tiene el mismo problema. Si es posible, guardar el previousClose del viernes anterior desde Yahoo en vez de copiar el precio actual los viernes.

## Validación

Después de aplicar los cambios:
1. Correr `actualizarPrecios()` manualmente
2. Verificar que la columna Precio (F) tenga el precio actual
3. Verificar que la columna Precio Ayer (O) tenga el `previousClose` de Yahoo (debería coincidir con el cierre real de ayer en páginas como Google Finance o TradingView)
4. Correr `enviarReporteDiario()` y verificar que las variaciones diarias sean coherentes

## Referencia de columnas Portfolio (CONFIG.port)

```
ticker:       1   (A)
nombre:       2   (B)
moneda:       3   (C)
tipo:         4   (D)
nominales:    5   (E)
precio:       6   (F)
dpt:          7   (G)
ppc:          8   (H)
ppcUSD:       9   (I)
rendARS:      10  (J)
rendUSD:      11  (K)
pctPortfolio: 12  (L)
totalARS:     13  (M)
totalUSD:     14  (N)
precioAyer:   15  (O)
precioSemAnt: 16  (P)
```

## Precaución

- `recalcularPortfolio()` lee `precioAyer` y `precioSemAnt` del Portfolio existente antes de limpiar y reescribir. Asegurate de que los valores de `previousClose` escritos por `actualizarPrecios()` se preserven correctamente durante ese ciclo.
- La columna `precioAyer` la leen tanto `recalcularPortfolio()` (para preservarla) como `enviarReporteDiario()` (para calcular variación). Ambos deben seguir funcionando.
