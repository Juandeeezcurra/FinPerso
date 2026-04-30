# FinPerso — Portfolio Tracker

Aplicación web personal para visualizar y cargar inversiones, compartida con amigos que también la usan por su cuenta.

## Stack

- **Frontend:** HTML/CSS/JS estático (`index.html`), hosteado en **Netlify**
- **Backend/DB:** Google Sheets con Apps Script (`FinPerso_v12_script.gs`) — trae precios de acciones, dólar MEP/CCL y otros activos en tiempo real
- **Deploy:** GitHub → Netlify (auto-deploy en cada push a `main`)

## Arquitectura

```
index.html  ──fetch──▶  Google Apps Script (doGet/doPost)
                              │
                        Google Sheets
                        ├── Operaciones
                        ├── Portfolio
                        ├── Historial
                        ├── Tickers
                        ├── Valores
                        └── Efectivo
```

## Contexto de mercado

El tracker está orientado al mercado argentino y maneja:

- **Acciones y CEDEARs** cotizando en ARS y USD
- **Dólar MEP y CCL** — conversión y arbitraje vía bonos (AL30, GD30, etc.)
- **Tipo de cambio CCL** como referencia para valuación en USD de posiciones en ARS
- Cálculo de **precio promedio de compra (PPC)** en ARS y USD, rendimiento y % del portfolio

## Setup para usuarios nuevos

1. Hacer una copia del Google Sheet y deployar el Apps Script como Web App
2. Actualizar la URL del script en `index.html`
3. Abrir `index.html` directamente (o usar el dominio de Netlify)

> El código del script está en `FinPerso_v12_script.gs` — la versión PDF de referencia en `FinPerso_v12_script.gs.pdf`

## Desarrollo

Claude Code tiene acceso a este repo vía GitHub. Cada cambio se pushea a `main` y Netlify lo deploya automáticamente. Los cambios al GS (Apps Script) deben hacerse manualmente en Google.
