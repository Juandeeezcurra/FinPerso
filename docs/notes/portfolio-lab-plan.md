# Portfolio Lab - Plan de producto y arquitectura

## Objetivo

Crear una nueva seccion de FinPerso para analizar, simular y optimizar portfolios desde una mirada mas profesional de wealth management.

La pestana debe cumplir dos objetivos:

1. Ayudar a entender mejor donde esta parado el portfolio actual.
2. Servir como laboratorio de aprendizaje sobre mercados, riesgo, retorno, diversificacion y portfolio management.

La idea no es solo mostrar numeros, sino transformar los datos en diagnosticos claros: que riesgos hay, que trade-offs aparecen y que cambia cuando se agrega, se quita o se rebalancea un activo.

## Nombre propuesto

Nombre recomendado: `Portfolio Lab`

Alternativas:

- `Wealth Lab`
- `Optimizer`
- `Analisis Pro`
- `Portfolio Studio`

`Portfolio Lab` es el mejor nombre inicial porque cubre diagnostico, simulacion, optimizacion y aprendizaje. No limita la seccion a Markowitz ni a una recomendacion automatica.

## Principios de diseno

- La pestana debe sentirse tecnica, pero usable.
- Todo resultado cuantitativo debe mostrar el supuesto detras.
- El usuario tiene que poder comparar cartera actual vs cartera simulada.
- Los comentarios de FinPerso deben explicar los trade-offs, no solo decir si algo es bueno o malo.
- El motor debe funcionar primero con reglas y formulas transparentes; una capa de IA puede venir despues.
- La herramienta debe aclarar que es educativa y analitica, no asesoramiento financiero.

## MVP recomendado

El primer MVP deberia incluir:

- Diagnostico del portfolio actual.
- Metricas de riesgo y retorno.
- Matriz de correlacion entre activos.
- Beta y alpha vs benchmark.
- Drawdown historico.
- Simulador de pesos.
- Comparacion actual vs simulado.
- Comentarios automaticos de FinPerso basados en reglas.

No conviene empezar por un optimizador completo. Primero necesitamos que los datos historicos, las conversiones de moneda y las metricas funcionen bien.

## Estructura de la pestana

### 1. Diagnostico actual

Snapshot de la cartera real usando los datos actuales de `Portfolio`.

Metricas:

- Valor total en USD y ARS.
- Cantidad de posiciones.
- Peso por activo.
- Peso por tipo de activo.
- Peso por moneda.
- Top 3 y top 5 posiciones.
- Concentracion top 3.
- Concentracion top 5.
- Herfindahl-Hirschman Index.
- Cash ratio.
- Exposicion a activos manuales vs activos con cotizacion online.

Comentarios posibles:

- "El portfolio esta concentrado en pocas posiciones."
- "El cash representa una parte alta/baja del total."
- "La diversificacion por tipo de activo es limitada."
- "La exposicion en USD domina la cartera."

### 2. Risk and return stats

Bloque tecnico con estadisticas historicas del portfolio.

Metricas:

- Retorno diario promedio.
- Retorno anualizado.
- Volatilidad diaria.
- Volatilidad anualizada.
- Sharpe ratio.
- Sortino ratio.
- Max drawdown.
- Beta vs benchmark.
- Alpha CAPM.
- Tracking error.
- Information ratio.
- Value at Risk historico.
- Conditional Value at Risk.

Formulas base:

```text
Retorno diario = Precio_t / Precio_t-1 - 1
Retorno anualizado = (1 + retorno_promedio_diario) ^ 252 - 1
Volatilidad anualizada = volatilidad_diaria * sqrt(252)
Sharpe = (retorno_portfolio - risk_free_rate) / volatilidad_portfolio
Sortino = (retorno_portfolio - risk_free_rate) / downside_deviation
Beta = Cov(retorno_activo, retorno_benchmark) / Var(retorno_benchmark)
Alpha CAPM = retorno_portfolio - [risk_free_rate + beta * (retorno_benchmark - risk_free_rate)]
Tracking error = stdev(retorno_portfolio - retorno_benchmark)
Information ratio = exceso_retorno_vs_benchmark / tracking_error
```

### 3. Simulador dinamico

Espacio para construir un portfolio hipotetico.

Controles:

- Agregar ticker.
- Quitar ticker.
- Cambiar peso por activo.
- Normalizar pesos al 100%.
- Resetear al portfolio actual.
- Duplicar escenario actual.
- Elegir benchmark.
- Elegir periodo historico.
- Elegir risk-free rate.

Comparacion:

- Actual vs simulado.
- Cambio en retorno anualizado.
- Cambio en volatilidad.
- Cambio en Sharpe.
- Cambio en beta.
- Cambio en drawdown.
- Cambio en concentracion.
- Cambio en peso por tipo y moneda.

Ejemplo de caso:

```text
Si se baja MELI de 35% a 20% y se agrega SPY con 15%:
- baja la concentracion,
- puede bajar la volatilidad,
- puede mejorar el Sharpe,
- baja la exposicion idiosincratica,
- aumenta la exposicion al mercado estadounidense.
```

### 4. Correlaciones y covarianza

Vista para entender si la diversificacion es real o solo aparente.

Elementos:

- Matriz de correlacion.
- Matriz de covarianza.
- Ranking de pares mas correlacionados.
- Ranking de pares menos correlacionados.
- Contribucion marginal al riesgo por activo.
- Contribucion porcentual al riesgo total.

Formulas:

```text
Portfolio variance = w' * Sigma * w
Portfolio volatility = sqrt(w' * Sigma * w)
Marginal contribution to risk = Sigma * w / portfolio_volatility
Risk contribution = weight_i * marginal_contribution_i
Risk contribution percentage = risk_contribution_i / portfolio_volatility
```

### 5. Optimizer Markowitz

Fase posterior al MVP.

Modos:

- Max Sharpe.
- Minima volatilidad.
- Retorno objetivo.
- Volatilidad objetivo.
- Pesos iguales.
- Risk parity aproximado.

Restricciones:

- Long-only.
- Peso minimo por activo.
- Peso maximo por activo.
- Peso maximo por tipo de activo.
- Peso maximo por pais o region.
- Mantener activos fijos.
- Incluir o excluir cash.

Graficos:

- Efficient frontier.
- Punto del portfolio actual.
- Punto del portfolio simulado.
- Punto max Sharpe.
- Punto min variance.
- Scatter riesgo/retorno por activo.

Advertencia importante:

La optimizacion con retornos historicos puede sobreajustar. Por eso el optimizer debe mostrar supuestos y permitir escenarios conservadores.

## Datos necesarios

### Ya disponibles

Desde `Portfolio`:

- Ticker.
- Nombre.
- Moneda.
- Tipo.
- Nominales.
- Precio.
- PPC.
- Rendimiento.
- Peso en portfolio.
- Total ARS.
- Total USD.
- Precio ayer.

Desde `Historial`:

- Fecha.
- Total ARS.
- Total USD.
- CCL historico o derivable.

Desde `Valores`:

- CCL.
- MEP.
- Email.
- Configuraciones futuras.

Desde endpoint `Benchmark`:

- Series historicas desde Yahoo Finance para simbolos como `^MERV` y `^GSPC`.

### A agregar

Metadata por ticker:

- Yahoo symbol.
- Benchmark natural.
- Pais o region.
- Sector.
- Asset class.
- Moneda base.
- Es CEDEAR.
- Ratio CEDEAR, si se quiere modelar con mas precision.

Configuraciones:

- Risk-free rate ARS.
- Risk-free rate USD.
- Benchmark default ARS.
- Benchmark default USD.
- Periodo historico default.
- Max peso por activo default.

Datos historicos:

- Serie diaria por ticker.
- Idealmente adjusted close.
- Fallback a close si adjusted close no esta disponible.
- Conversion ARS/USD con CCL historico.

## Cambios en Apps Script

### Endpoint de market data

Opcion 1: extender `Benchmark`.

```text
GET ?sheet=Benchmark&symbol=AAPL&range=2y
```

Opcion 2: crear alias conceptual `MarketData`.

```text
GET ?sheet=MarketData&symbols=AAPL,SPY,MELI.BA&range=2y
```

Recomendacion:

Empezar extendiendo `Benchmark`, porque el codigo ya existe. Luego renombrar internamente si hace falta.

### Funcion historica generica

Crear una funcion reusable:

```text
_getYahooHistory(symbol, range, interval)
```

Debe devolver:

```json
[
  { "fecha": "2026-01-02", "close": 123.45, "adjClose": 122.90 },
  { "fecha": "2026-01-03", "close": 124.10, "adjClose": 123.55 }
]
```

### Cache

Para no pegarle a Yahoo cada vez:

- Usar `CacheService`.
- Cachear por `symbol + range + interval`.
- TTL sugerido: 30 a 120 minutos.

### Nuevas configs en Valores

Agregar claves sugeridas:

```text
Risk free USD
Risk free ARS
Benchmark USD
Benchmark ARS
Portfolio Lab range
Max weight default
```

## Cambios en frontend

### Navegacion

Agregar un nuevo item en sidebar:

```text
Portfolio Lab
```

Nueva seccion:

```html
<div id="sec-lab" class="section"></div>
```

Actualizar mapa de titulos:

```js
const titles = {
  resumen: 'Resumen',
  portfolio: 'Posiciones',
  operaciones: 'Operaciones',
  efectivo: 'Efectivo',
  lab: 'Portfolio Lab'
};
```

### Estado JS

Variables nuevas:

```js
let labMarketData = {};
let labScenario = [];
let labBenchmark = '^GSPC';
let labRange = '2y';
let labRiskFreeRate = 0.04;
let labStats = null;
```

### Componentes UI

Bloques:

- Header del lab.
- Cards de metricas.
- Tabla de pesos actuales.
- Tabla/sliders del escenario.
- Comparador actual vs simulado.
- Matriz de correlacion.
- Grafico riesgo/retorno.
- Panel de comentarios FinPerso.

Controles:

- Selector de benchmark.
- Selector de periodo.
- Input de risk-free rate.
- Boton recalcular.
- Boton resetear escenario.
- Boton normalizar pesos.
- Agregar ticker.

### Funciones principales

```text
renderPortfolioLab()
loadLabMarketData()
buildCurrentWeights()
buildScenarioFromPortfolio()
calculateReturnSeries()
calculatePortfolioSeries()
calculateRiskStats()
calculateCorrelationMatrix()
calculateCovarianceMatrix()
calculateBetaAlpha()
calculateDrawdown()
calculateScenarioStats()
generatePortfolioComments()
```

## Motor cuantitativo

### Retornos

Usar retornos diarios simples:

```text
r_t = price_t / price_t-1 - 1
```

Despues se puede agregar log returns:

```text
log_return_t = ln(price_t / price_t-1)
```

### Portfolio return

```text
portfolio_return_t = sum(weight_i * return_i_t)
```

### Annualizacion

```text
annual_return = (1 + avg_daily_return) ^ 252 - 1
annual_vol = daily_vol * sqrt(252)
```

### Benchmark

Benchmark default sugerido:

- Para vista USD: `^GSPC` o `SPY`.
- Para vista ARS: `^MERV`.

Mas adelante:

- Benchmark combinado por moneda o asset class.
- Benchmark personalizado.

## Comentarios automaticos de FinPerso

Los comentarios deben salir de reglas interpretables.

Reglas iniciales:

```text
Si top_1_weight > 35%:
  "La cartera depende mucho de una sola posicion."

Si top_3_weight > 65%:
  "La concentracion en las tres principales posiciones es alta."

Si sharpe < 0:
  "El retorno ajustado por riesgo fue negativo en el periodo analizado."

Si sharpe > 1:
  "El retorno ajustado por riesgo fue saludable en el periodo analizado."

Si beta > 1.2:
  "El portfolio se comporta mas agresivamente que el benchmark."

Si beta < 0.8:
  "El portfolio se comporta mas defensivamente que el benchmark."

Si max_drawdown < -25%:
  "El portfolio tuvo caidas historicas profundas; revisar tolerancia al riesgo."

Si avg_correlation > 0.75:
  "La diversificacion real puede ser menor a la aparente."

Si simulated_sharpe > current_sharpe:
  "El escenario simulado mejora el retorno ajustado por riesgo."
```

Categorias de comentario:

- Concentracion.
- Riesgo.
- Retorno.
- Diversificacion.
- Moneda.
- Benchmark.
- Escenario simulado.
- Calidad de datos.

## Fases de implementacion

### Fase 1 - Base analitica

- Agregar pestana `Portfolio Lab`.
- Crear layout inicial.
- Calcular pesos actuales.
- Mostrar concentracion, cash ratio y distribucion.
- Traer historicos de tickers actuales.
- Calcular retorno, volatilidad, Sharpe y drawdown.
- Mostrar comentarios basicos.

### Fase 2 - Benchmark y beta

- Extender endpoint historico.
- Traer benchmark elegido.
- Calcular beta.
- Calcular alpha CAPM.
- Calcular tracking error.
- Mostrar comparacion contra benchmark.

### Fase 3 - Simulador

- Crear escenario editable.
- Agregar/quitar tickers.
- Sliders o inputs de pesos.
- Normalizar pesos.
- Comparar metricas actual vs simulado.
- Comentarios sobre diferencias.

### Fase 4 - Correlaciones

- Matriz de correlacion.
- Matriz de covarianza.
- Ranking de pares.
- Contribucion al riesgo.

### Fase 5 - Optimizer

- Efficient frontier.
- Max Sharpe.
- Min variance.
- Restricciones.
- Guardar escenarios.

### Fase 6 - Wealth mode

- Perfil de riesgo.
- Horizonte temporal.
- Objetivo: crecimiento, preservacion, income o liquidez.
- Reporte interpretativo estilo asesor.
- Checklist de decisiones.

## Riesgos y decisiones pendientes

- Yahoo Finance puede fallar o limitar respuestas.
- Adjusted close puede no estar disponible para todos los activos.
- CEDEARs requieren cuidado con moneda, ratio y CCL.
- Historicos cortos pueden generar metricas inestables.
- Markowitz puede sobreoptimizar si no se agregan restricciones.
- La app actual es un HTML grande; conviene mantener el primer cambio acotado.
- Antes de escalar mucho, conviene mejorar seguridad del frontend y API token.

## Definicion de listo para el MVP

El MVP esta listo cuando:

- La pestana aparece en la navegacion.
- Carga el portfolio actual.
- Trae historicos para los tickers principales.
- Calcula metricas basicas de riesgo y retorno.
- Muestra al menos un grafico relevante.
- Permite modificar pesos de un escenario.
- Compara actual vs simulado.
- Genera comentarios automaticos utiles.
- Maneja errores de datos sin romper la app.

## Primer paso tecnico sugerido

Empezar por el backend:

1. Generalizar `_getBenchmarkData` a `_getYahooHistory`.
2. Permitir `range` parametrizable.
3. Devolver `adjClose` si Yahoo lo trae.
4. Agregar cache.
5. Probar con `SPY`, `AAPL`, `MELI`, `^GSPC`, `^MERV` y algun ticker `.BA`.

Despues avanzar en frontend:

1. Agregar pestana.
2. Renderizar layout vacio.
3. Construir pesos actuales.
4. Cargar series historicas.
5. Calcular y mostrar primeras metricas.
