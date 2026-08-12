# Estado del proyecto

**Última actualización:** agosto de 2026
**Aplica a:** commit `f8bf4fd` (branch `docs/handoff-epc-2026-08`)

Este documento describe el estado detallado del proyecto: qué está hecho, qué falta, métricas, issues conocidos y optimizaciones pendientes.

---

## Resumen ejecutivo

| Métrica | Valor |
|---|---|
| **Tests automatizados** | 2123 verde (171 suites) |
| **Type check** | `tsc --noEmit` sin errores |
| **Compliance CRA 825/2017** | 8/10 gaps cerrados (2 diferidos) |
| **SDDs archivados** | 22+ en `openspec/changes/archive/` |
| **SDDs activos** | 3 (eliminar-campo-calle, factura-compliance-fase1, factura-compliance-polish) |
| **Branches activas** | `main`, `desarrollo`, `merge-desarrollo`, `docs/handoff-epc-2026-08` |
| **Stack mobile** | Expo SDK 54 + React Native 0.81 |
| **Stack backend** | .NET 8 + PostgreSQL 16 |

---

## Estado por componente

### Dominio (TypeScript compartido)

**Estado:** completo + compliance CRA 825 cerrado.

- ✅ 18 módulos de dominio implementados en `mobile/src/{modulo}/`
- ✅ Motor tarifario CRA 825/2017 + 907/2019 + 750/2016 con flag `aplica_cmaa`
- ✅ Validaciones: `validarAmbito`, `validarCmogMinimo`, validaciones de motor
- ✅ Migración 030 aditiva idempotente para flag `aplica_cmaa`
- ✅ Multi-tenancy con FK `id_prestador`
- ✅ Tests: 2123/2123 verde, cobertura alta en módulos de dominio

### Mobile (Expo + React Native)

**Estado:** MVP funcional con compliance cerrado.

- ✅ 8+ pantallas principales (RutaDeHoy, CapturarLectura, ParametrosTarifa, Login, SetupInicial, Sincronizacion, Configuracion)
- ✅ ParametrosTarifa decompuesto 1155 → 456 líneas (-60.5%) en 9 archivos cohesivos
- ✅ Persistencia con `expo-sqlite` + repositorios que implementan puertos del dominio
- ✅ Composición con bootstrap + DI
- ✅ Sync manual con cola idempotente
- ✅ Auth multi-tenant con SHA-256 client-side
- ✅ Setup inicial wizard (2 pasos)
- ⚠️ Token de sesión es `fake-token-{timestamp}` (NO producción)

### Backend (.NET 8)

**Estado:** MVP funcional, sin deploy productivo.

- ✅ API REST con Minimal API + EF Core 8 + Npgsql
- ✅ 13 endpoints REST (suscriptores, medidores, lecturas, liquidaciones, operarios, health)
- ✅ Organización por features con SyncHandler genérico
- ✅ Migraciones EF Core aplicadas (Inicial, ModeloCompleto, ReconciliarConDominioMobile, AgregarOperarios)
- ✅ Dashboard web HTML estático servido desde backend
- ✅ Validación con FluentValidation
- ✅ Logging estructurado con Serilog
- ⚠️ NO desplegado en producción
- ⚠️ Sin pipeline CI/CD productivo

### Dashboard web

**Estado:** MVP funcional.

- ✅ HTML5 + Vanilla JS (sin frameworks)
- ✅ bcrypt.js client-side para hash de passwords
- ✅ CRUD operarios + vincular dispositivo
- ✅ Consulta de suscriptores, lecturas, liquidaciones

---

## Compliance CRA 825/2017

### Cerrado (8 gaps)

| Gap | Cambio | Descripción |
|---|---|---|
| CMA mínimo | `param-tarifa-res-825-compliance-phase1` | Costo Medio de Administración mínimo |
| IPC | `param-tarifa-res-825-compliance-phase1` | Índice de Precios al Consumidor editable, año base 2016 |
| Campo `aps` | `param-tarifa-res-825-compliance-phase1` | Pérdidas técnicas agregadas al modelo |
| Fórmula CF corregida | `param-tarifa-res-825-compliance-phase2` | Cargo Fijo recalculado |
| CMAA | `param-tarifa-res-825-compliance-phase2` + `param-tarifa-residuales-cra-825` | Inversiones ambientales con flag `aplica_cmaa` opt-in |
| `validarAmbito` | `param-tarifa-res-825-compliance-phase2` | Validación de ámbito de aplicación |
| `validarCmogMinimo` | `param-tarifa-res-825-compliance-phase2` | Validación CMOG mínimo |
| Mínimo vital | `param-tarifa-residuales-cra-825` | Unificación Opción A (cargo fijo puede ser 0) |
| Inputs IPC editables | `param-tarifa-residuales-cra-825` | Admin puede editar IPC y año base |
| Migración aditiva | `param-tarifa-residuales-cra-825` | Migración 030 idempotente |

### Diferido explícitamente (2 gaps)

| Gap | Cambio futuro | Razón del diferimiento |
|---|---|---|
| **GAP-6** MetadataCalculo completo §11 | `auditoria-mejorada-cra-825` | Requiere 20+ campos adicionales de trazabilidad. Cambio dedicado por scope. |
| **GAP-10** Contrato de salida del agente IA §12 | `agente-validacion-cra-825` | Depende de decisiones de producto sobre integración de IA. |

**Estado del compliance:** 80% cerrado (8/10 gaps). NO dar por cerrado hasta abordar GAP-6 y GAP-10.

---

## Issues conocidos

### Críticos (bloquean producción)

_Ninguno al cierre de esta entrega._

### Importantes (deben abordarse pronto)

1. **Token de sesión fake-token.** El token actual es `fake-token-{timestamp}` con expiración hardcoded a 24 horas. NO usar como mecanismo de seguridad en producción. Migración a GUID generado por backend .NET con `expiresAt` validado contra PostgreSQL.
2. **Backend sin deploy productivo.** Está configurado para dev local. NO hay pipeline CI/CD ni configuración de hosting. Esta decisión queda para EPC.

### Menores (limpieza)

1. **Directorio `src/__tests__/` residual.** Existe en la raíz del proyecto como leftover del SDD `delete-legacy-src-mirror`. NO contiene tests activos, pero es ruido. Considerar agregar a `.gitignore` o borrar.
2. **Branch `merge-desarrollo` pendiente de cerrar.** Ya está mergeada a `main`. Limpieza: `git push origin --delete merge-desarrollo`.
3. **SDDs activos sin cerrar.** Hay 3 SDDs abiertos en `openspec/changes/` (`eliminar-campo-calle`, `factura-compliance-fase1`, `factura-compliance-polish`). Decidir si cerrarlos o continuar trabajo.

---

## Optimizaciones pendientes

### Performance

1. **Bundle size de Expo.** Evaluar tree-shaking y lazy loading de pantallas no usadas.
2. **Query N+1 en dashboard.** El listado de lecturas con medidor y suscriptor podría optimizarse con JOINs eager.
3. **Sync incremental.** Actualmente la sync envía todos los pendientes. Evaluar sync incremental con cursor.

### Code quality

1. **ParametrosTarifaScreen.tsx sigue en 456 líneas** (post-decompose). Podría continuar decomponiendo subcomponentes grandes si crecen.
2. **`composicion/` vs `composition/`** — naming consistente (el proyecto usa español para algunos paths e inglés para otros).
3. **Migraciones SQL inline (889 líneas).** Considerar extraer a archivos `.sql` separados.

### Testing

1. **Cobertura de UI.** Tests actuales cubren dominio + repos. UI (pantallas, componentes) está sub-testada.
2. **E2E tests.** No hay tests end-to-end automatizados. Considerar Detox o Maestro.
3. **Mutation testing.** No se corre mutation testing. Considerar Stryker para validar calidad de los tests.

---

## Métricas históricas

| Fecha | Métrica | Cambio |
|---|---|---|
| 2026-04-30 | Tests | Estructura inicial de módulos |
| 2026-05-03 | Tests | Refactor factura aggregate + persistencia SQLite |
| 2026-05-19 | Backend | Migración a Clean Architecture .NET |
| 2026-07-09 | Auth | Setup inicial multi-tenant + login |
| 2026-07-29 | Compliance | Factura-compliance-fase1 + hardening + cleanup |
| 2026-07-30 | Compliance CRA 825 | Fase 1 cerrada (CMA mínimo, IPC, año base) |
| 2026-08-03 | UI | ParametrosTarifa rediseño + Factura Bluetooth |
| 2026-08-10 | Compliance CRA 825 | Fase 2 cerrada (8/10 gaps) + Fase 3 (residuales) |
| 2026-08-10 | Cleanup | Delete legacy `src/` mirror (135 archivos) |
| 2026-08-11 | UI | ParametrosTarifa decompose 1155 → 456 líneas |
| 2026-08-12 | Tests | 2123/2123 verde, fix `npm test` raíz |

---

## Próximos pasos sugeridos (no urgentes)

1. Cerrar la branch `merge-desarrollo` local y remote.
2. Abordar GAP-6 (`auditoria-mejorada-cra-825`) y GAP-10 (`agente-validacion-cra-825`) cuando el equipo lo priorice.
3. Migración del token fake-token a GUID real con expiración validada contra PostgreSQL.
4. Pipeline CI/CD productivo para backend .NET.
5. Evaluar los 3 SDDs activos en `openspec/changes/` y cerrarlos o continuarlos.
6. Tests E2E con Detox o Maestro.

---

## Cómo verificar el estado actual

```bash
# Estado de tests
npm test

# Cobertura
npm run test:coverage

# Type check
cd mobile && npx tsc --noEmit

# Listar SDDs activos
ls openspec/changes/

# Listar SDDs archivados
ls openspec/changes/archive/

# Estado de branches
git branch -a
```
