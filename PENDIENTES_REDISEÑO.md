# Pendientes — Rediseño FinPerso

**Estado: CERRADO** ✓

Todas las tareas de limpieza post-rediseño fueron completadas.

## Completado
- **Tarea 1 — CSS legacy:** bloque viejo (líneas 15–295) reemplazado por un bloque reducido de utilidades preservadas. `!important` innecesarios removidos (quedan 4 en `@media` mobile para forzar visibilidad del bottom nav).
- **Tarea 2 — Inline styles en render functions:** `renderPortfolio()`, `renderOperaciones()` y `renderEfectivo()` ahora usan clases del design system (`.ticker-name`, `.ticker-code`, `.cell-muted`, `.cell-nowrap`, `.row-pos`, `.row-neg`, `.pos`/`.neg` en celdas). Clases agregadas al design system para soportar el reemplazo.
- **Tarea 3 — Handoff:** este archivo refleja el estado final.

## Notas
- Quedan algunos `style="..."` inline en HTML estático (setup screen, leyendas de chart, chips con colores dinámicos por tipo/orden) — no molestan y no son repetitivos.
- Los tokens `--muted`/`--muted2` siguen definidos porque algunos elementos inline los usan; se pueden migrar a `--text-tertiary` en una pasada futura si molesta.
