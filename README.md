# FinPerso - Portfolio Tracker

Aplicacion web personal para visualizar, cargar y analizar inversiones desde un frontend local conectado a Google Sheets via Apps Script.

## Stack

- **Frontend:** HTML/CSS/JS estatico en `index.html`, servido por GitHub Pages para uso diario y localmente para desarrollo.
- **Backend/DB:** Google Sheets con Apps Script en `apps-script/FinPerso_v12_script.gs`.
- **Export:** copia exportada en `export/FinPerso.html`.
- **Uso web/celular:** GitHub Pages desde `main`.
- **Ejecucion local:** `start-local.ps1` / `start-local.cmd` levantan un servidor local y abren la app.

## Arquitectura

```text
GitHub Pages / index.html local  --fetch-->  Google Apps Script (doGet/doPost)
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
- `start-local.ps1`: launcher local para abrir FinPerso en el navegador.
- `start-local.cmd`: wrapper de Windows para ejecutar el launcher sin pelearse con la policy de PowerShell.
- `manifest.json`: manifest PWA usado por `index.html`.
- `assets/`: iconos y assets usados por la app.
- `assets/source/`: fuentes o versiones base de assets generados.
- `export/`: version HTML exportada.
- `legacy/`: snapshots historicos que no forman parte del deploy principal.
- `apps-script/`: codigo fuente del Apps Script. Los cambios en Google Apps Script se aplican manualmente desde el editor de Google.
- `docs/audits/`: auditorias tecnicas actuales.
- `docs/reviews/`: revisiones tecnicas y reportes de fixes historicos.
- `docs/notes/`: notas de bugs o investigaciones puntuales.
- `.claude/`: configuracion local de Claude/Codex.

## Setup web y celular

Para usar FinPerso desde Safari/iPhone o cualquier navegador, publicar el repo con GitHub Pages:

1. Ir al repo en GitHub: `Juandeeezcurra/FinPerso`.
2. Entrar a `Settings` -> `Pages`.
3. En `Build and deployment`, elegir:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`
4. Guardar.
5. Abrir:

```text
https://juandeeezcurra.github.io/FinPerso/
```

La primera vez en ese dominio, FinPerso va a pedir nuevamente la URL del Web App de Apps Script porque esa configuracion vive en `localStorage` del navegador.

Netlify puede quedar apagado; GitHub Pages cumple el mismo rol de hosting estatico para uso personal.

## Setup local

1. Crear o copiar el Google Sheet.
2. Copiar el contenido de `apps-script/FinPerso_v12_script.gs` en Apps Script.
3. Deployar el Apps Script como Web App.
4. Ejecutar la app local:

```powershell
.\start-local.ps1
```

Tambien se puede abrir con doble click en `start-local.cmd`.

5. Abrir FinPerso y pegar la URL del Web App cuando la app lo pida.

El script abre `http://localhost:8080/index.html`. Si ese puerto esta ocupado:

```powershell
.\start-local.ps1 -Port 8081
```

Si queres levantar el servidor sin abrir el navegador automaticamente:

```powershell
.\start-local.ps1 -NoBrowser
```

Si queres abrirlo desde el telefono usando la misma WiFi que la PC:

```powershell
.\start-local.ps1 -Lan
```

El script imprime una URL tipo `http://192.168.x.x:8080/index.html`.

## Desarrollo

El frontend se modifica en `index.html`. Para mantener la copia exportada alineada:

```powershell
Copy-Item -LiteralPath index.html -Destination export/FinPerso.html
```

Los cambios al Apps Script deben hacerse manualmente en Google Apps Script; este repo sirve como referencia/versionado del codigo.

Netlify ya no es parte del flujo principal. Si algun dia se quiere volver a compartir la app, alcanza con hostear nuevamente el HTML estatico y mantener el mismo Web App de Apps Script.
