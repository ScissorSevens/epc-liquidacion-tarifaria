# 6. Validación de cálculos tarifarios

**Indicador de medida:** Resultados de cálculo validados
**Fecha de inicio:** 10/08/2026
**Fecha de terminación:** 14/08/2026
**% Avance:** (no especificado)

## Resumen ejecutivo

Esta actividad ejecuta la validación integral de los cálculos tarifarios bajo la metodología CRA 825/2017 + 907/2019 + 750/2016. Cubre la implementación de los gaps de compliance restantes, la refactorización del módulo `ParametrosTarifa` y su decompose en subcomponentes cohesivos. La validación combina tests automatizados (TDD-strict), refactor modular y limpieza de espejos legacy.

## Trabajo realizado

- **Compliance CRA 825 — Fase 2 cerrada:** 8 de 10 gaps cerrados (16 commits). Fórmula CF corregida, CMAA, `validarAmbito`, `validarCmogMinimo`, `Acuerdo.estado`, `estado_verificacion`, 3 campos docs adicionales, `@deprecated calcularCCUnitario`.
- **Compliance CRA 825 — Fase 3 (residuales):** 6 gaps adicionales cerrados (13 commits). Flag `aplica_cmaa` opt-in explícito, inputs IPC editables, unificación mínimo vital Opción A, migración 030 aditiva idempotente, refactors `num()`/`entero()` a utils, `validarTodo()` a módulo puro.
- **Decompose `ParametrosTarifa.tsx`:** 1155 → 456 líneas (-60.5%) en 9 archivos cohesivos (1 main + 1 hook `useParametrosFormState` + 6 subcomponentes presentacionales + 1 `IconoGuardar` extraído). 20 commits atómicos con TDD-strict.
- **Cleanup post-archive:**
  - F1: drop `useFocusEffect` no-op en `useParametrosFormState`.
  - F2: extracción `num()`/`entero()` a `utils/parse-numeric`.
  - F3: extracción `validarTodo()` a módulo puro testeable.
- **Delete legacy `src/` mirror:** 135 archivos legacy borrados + `jest.config.ts` root. CI reescrito para correr mobile tests con trigger correcto a `desarrollo`.
- **Merge desarrollo → main:** consolidación de los 100+ commits de las fases de compliance en `main`.

## Evidencia

- **Commits:** 100 commits en el rango 10/08-14/08/2026 (mega-sesión de cleanup + compliance)
- **Tests:** 2123 verde al cierre, 171 suites
- **PRs:** #5 (merge-desarrollo a main) cerrado
- **Archivos clave:**
  - `mobile/src/pantallas/admin/ParametrosTarifa.tsx` (refactor de 1155 a 456 líneas)
  - `mobile/src/pantallas/admin/useParametrosFormState.ts` (hook nuevo)
  - `mobile/src/pantallas/admin/ParametrosTarifa{Costos, Periodo, Agua, Altitud, Soporte, IPC}.tsx` (subcomponentes)
  - `mobile/src/persistencia/expo-sqlite/migraciones/030_aplica_cmaa.ts` (nueva)
- **Skills aplicadas:** `impeccable` (decompose), TDD-strict
- **Métrica:** compliance CRA 825 al 80% (8/10 gaps cerrados)

## Estado

✅ **Completo.** Los cálculos tarifarios están validados contra la metodología CRA 825/2017 + 907/2019 + 750/2016 con tests TDD-strict, y la pantalla de configuración está refactorizada para mantenibilidad. Los 2 gaps diferidos (GAP-6 MetadataCalculo, GAP-10 agente IA) están mapeados a cambios dedicados futuros.
