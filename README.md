# FinPerso - Portfolio Tracker

Aplicacion web personal para visualizar y cargar inversiones, compartida con amigos que tambien la usan por su cuenta.

## Stack

- **Frontend:** HTML/CSS/JS estatico en `index.html`, hosteado en Netlify.
- **Backend/DB:** Google Sheets con Apps Script en `apps-script/FinPerso_v12_script.gs`.
- **Export:** copia exportada en `export/FinPerso.html`.
- **Deploy:** GitHub -> Netlify, con auto-deploy en cada push a `main`.

## Arquitectura

```text
index.html  --fetch-->  Google Apps Script (doGet/doPost)
                              |
                        Google Sheets
                        |-- Operaciones
                        |-- Portfolio
                        |-- Historial
                        |-- Tickers
                        |-- Valores
                        `-- Efectivo
```

## Contexto de mercado

El tracker esta orientado al mercado argentino y maneja:

- Acciones y CEDEARs cotizando en ARS y USD.
- Dolar MEP y CCL, con conversion y arbitraje via bonos.
- Tipo de cambio CCL como referencia para valuacion en USD de posiciones en ARS.
- Calculo de precio promedio de compra (PPC), rendimiento y porcentaje del portfolio.

## Estructura del repo

- `index.html`: app web principal.
- `export/`: version HTML exportada.
- `apps-script/`: codigo fuente del Apps Script. Los cambios en Google Apps Script se aplican manualmente desde el editor de Google.
- `docs/reviews/`: revisiones tecnicas y reportes de fixes historicos.
- `docs/notes/`: notas de bugs o investigaciones puntuales.
- `.claude/`: configuracion local de Claude/Codex.

## Setup para usuarios nuevos

1. Crear o copiar el Google Sheet.
2. Copiar el contenido de `apps-script/FinPerso_v12_script.gs` en Apps Script.
3. Deployar el Apps Script como Web App.
4. Abrir FinPerso y pegar la URL del Web App cuando la app lo pida.

## Desarrollo

Los cambios de frontend se pushean a `main` y Netlify los deploya automaticamente.

Los cambios al Apps Script deben hacerse manualmente en Google Apps Script; este repo sirve como referencia/versionado del codigo.
