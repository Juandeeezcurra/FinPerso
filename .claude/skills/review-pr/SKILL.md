---
name: review-pr
description: Review a GitHub pull request in the lemon-data repo. Analyzes code quality, DAG conventions, dbt model correctness, business logic, and security. Use when the user asks to review, check, or approve a PR.
argument-hint: "[pr-number-or-url]"
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash, Agent
---

# Lemon Data — PR Review Skill

Reviewá el PR **#$ARGUMENTS** de `lemonatio/lemon-data`.

## Paso 1: Traer el PR

**Por qué `gh` falla dentro del sandbox:** el sandbox de Claude Code (`SANDBOX_RUNTIME=1`) bloquea el keychain de macOS y el trust store del sistema. `gh` guarda el token en el keychain, así que dentro del sandbox `gh auth status` devuelve "token inválido" y la llamada HTTPS falla con `x509: OSStatus -26276` — aunque en el shell del usuario `gh` funcione perfecto. No es VPN ni proxy. Es aislamiento del sandbox.

**Única excepción de bypass en esta skill** — usar `dangerouslyDisableSandbox: true` **solo** para los dos comandos de lectura de `gh`:

```bash
gh pr view $ARGUMENTS --json number,title,author,state,baseRefName,headRefName,body,additions,deletions,changedFiles,labels,mergeable,files
gh pr diff $ARGUMENTS
```

**Scope estricto del bypass:**
- Solo `gh pr view` y `gh pr diff` (lectura).
- NUNCA bypassear para: `gh pr comment/review/create/merge/close`, `gh auth`, `git push`, `git config`, cualquier comando que modifique estado remoto/local, o comandos que no sean estos dos.
- El resto del review (Read, Grep, Glob, análisis) corre sandboxed — sin excepciones.

Si aun con bypass falla:
- `Bad credentials` / `token is invalid` → token realmente expirado. Pedile al usuario que corra `gh auth login -h github.com -p https -w`.
- TLS error *con* sandbox desactivado → ahí sí puede ser VPN/proxy corporativo. Probar `env -u HTTPS_PROXY -u HTTP_PROXY gh ...` o pedirle al usuario que desactive el proxy.

**Fallback — git local** (si el usuario prefiere no bypassear, o el token está expirado y no puede renovarlo ahora):

```bash
# También requiere dangerouslyDisableSandbox: true para leer credenciales de git
git -C lemon-data fetch origin pull/$ARGUMENTS/head:pr-$ARGUMENTS
git -C lemon-data log main..pr-$ARGUMENTS --oneline
git -C lemon-data diff main...pr-$ARGUMENTS                    # triple-dot: contra merge-base
git -C lemon-data log pr-$ARGUMENTS -1 --format="%an <%ae>"
```

Con fallback **no** obtenés: título, descripción, labels, comments, estado de CI. Decilo explícito si el usuario pregunta por eso.

## Paso 2: Clasificar archivos

| Prefijo | Tipo | Foco |
|---------|------|------|
| `dags/*.py` | DAG Airflow | Convenciones, secrets, callbacks |
| `dags/data-products/models/**/*.sql` | Modelo dbt | Lógica de negocio, métricas, joins |
| `jobs/` | Job ECS/Fargate | Errores, reintentos, timeouts |
| `plugins/` | Utilidades compartidas | Backward compat, DAGs dependientes |
| `.github/workflows/` | CI/CD | Seguridad, permisos |
| `code-checks/` | Validaciones PR | No romper checks existentes |

## Paso 3: Review técnico

Convenciones del repo están en `dags/CLAUDE.md` y `code-checks/`. Verificá contra el diff — los checks relevantes:

**DAGs**: `max_active_runs=1`, `catchup=False`, `tags` con BANKING/CARDS/CRYPTO/COMPLIANCE/DEV/INFRA/DATA, `start_date` (no `days_ago`), `schedule_interval`, `execution_timeout`, secrets vía `plugins.secrets_utils` (nunca `os.environ`/`Variable.get`), sin llamadas top-level fuera del `with DAG(...)`, `on_failure_callback` con Slack. INSERT/UPDATE → sugerir `bulk_insert`/`bulk_update` de `redshift_utils`.

**dbt**: joins con condición correcta (no cartesianos), sin `SELECT *`, idempotencia. Si toca `users_journey`, `users_margen`, `user_categ`, `users_ltv` → revisá definiciones de métricas (ARPU, CAC, MAU, LTV) contra CLAUDE.md. Levels no bajan (1→2→3).

**Plugins**: buscá DAGs afectados con `grep -r "from plugins.<nombre> import" dags/`.

## Paso 4: Review de negocio

Solo si el diff toca datos de usuarios, revenue/margen, pagos, balance/AUC, o retención/MAU — cruzá contra las definiciones de Lemon Brain en CLAUDE.md. No inventes hallazgos si el PR no toca esas áreas.

## Paso 5: Archivos relacionados no incluidos

Modelo dbt modificado → ¿`schema.yml`, tests, docs? DAG modificado → ¿job en `jobs/`, workflow en `.github/workflows/`?

## Paso 6: Output

**Regla de scope:** solo se evalúa lo que **este PR cambia** (líneas `+` del diff). Si el antipatrón ya existía y el PR no lo toca, va en "Pre-existente" (opcional, no afecta veredicto). Excepción: código nuevo que replica un antipatrón pre-existente → del PR.

Formato (conciso — una línea por hallazgo cuando sea posible, cita `archivo:línea`):

```
PR #N — <título> · <autor> · +A/-D en F archivos · head → base

**Resumen:** <1-2 oraciones>

**Hallazgos**
- CRITICO · archivo.py:42 — <qué + por qué>
- IMPORTANTE · modelo.sql:15 — <qué + por qué>
- MENOR · ...
- POSITIVO · ...

**Pre-existente** (opcional, omitir si no hay nada) — una línea por ítem.

**Veredicto:** APROBAR | APROBAR CON COMENTARIOS | SOLICITAR CAMBIOS
```

Severidades: **CRITICO** bloquea (bugs, seguridad, pérdida de datos). **IMPORTANTE** convenciones rotas, métricas mal, perf. **MENOR** estilo/naming. **POSITIVO** buenas prácticas en los cambios.

## Notas

- Español siempre.
- Explicá el "por qué", no solo el "qué" — en una línea.
- Sin hallazgos → decilo. No inventes.
- Priorizá precisión sobre largo: si un review cabe en 10 líneas, que sean 10.
- Leé archivos completos solo cuando el diff no alcance para juzgar el cambio.
