# 4. Pruebas funcionales del sistema

**Indicador de medida:** Pruebas realizadas y documentadas
**Fecha de inicio:** 27/07/2026
**Fecha de terminación:** 7/08/2026
**% Avance:** 4%

## Resumen ejecutivo

Esta actividad ejecuta la batería de pruebas funcionales del sistema con TDD-strict en modo avanzado. Resultado: 100+ bugs y mejoras detectadas y corregidas, derivadas tanto de revisión manual como de la ejecución de la suite automatizada. La cobertura de tests cerró el período en 2123 tests verde, 171 suites.

## Trabajo realizado

- **Bug fix: `cargo_resultante` persistido en motor.** El motor tarifario usaba `cargo_resultante` calculado en runtime en lugar del persistido — fix en `calcularLiquidacion` para usar el valor correcto.
- **UX de captura de lectura:**
  - `lectura_anterior` readonly cuando hay historial (no editable en visitas subsecuentes).
  - Hide input `lectura_anterior` cuando hay historial (no redundancia visual).
  - Hide nav bar después de captura (ResultadoCalculo sin back ni footer, sólo botón Continuar).
  - PopToTop on Continuar + drop "volver-a-la-ruta".
- **Multi-tenant mobile:** `suscriptor.id_prestador` se persiste correcto (no 0) — fix de AltaSuscriptor hardcode + SQL_INSERT que omitía la columna.
- **Workspace session:** `useWorkspace.setSesionCompleta` carga el contexto del prestador después del sync de sesión.
- **SQL defensivo:**
  - Regex `idempotizarResto020` corregido para SQL con `IF NOT EXISTS`.
  - `strftime %f` reemplazado por `CURRENT_TIMESTAMP` en expo-sqlite (defensivo contra SQLite 3.50.3).
  - Reorder `NOT NULL DEFAULT (expr)` → `DEFAULT (expr) NOT NULL` en migraciones expo-sqlite.
- **Auth flow:**
  - First-launch-post-reinstall bug fix: `AuthGate` cold-boot flow + UI `error_db` + reorder SQL.
  - Catch general de `AuthGate` routea a `error_db` (no a `sin_sesion` dead-end).
  - Botón "Limpiar y continuar" en auth routea a `SetupInicial` (no a Login dead-end).
- **TDD-strict workflow:** cada bug fix va con su test RED antes del GREEN — patrón `[RED]` / `[GREEN]` en commits.

## Evidencia

- **Commits:** 172 commits en el rango 27/07-07/08/2026 (período de TDD intensivo)
- **Tests:** 2123 tests verde, 171 suites al cierre
- **Métrica:** 0 CRITICAL en code review multi-axis
- **Skills aplicadas:** `code-review-and-quality` (5 ejes), TDD-strict, `impeccable` (UX)

## Estado

✅ **Completo.** La suite completa de pruebas funcionales pasa. La metodología TDD-strict deja una huella clara de qué se probó y por qué. Los 2 issues pendientes (token fake-token, backend sin deploy) están documentados en `docs/PROJECT_STATUS.md` como riesgos para producción.
