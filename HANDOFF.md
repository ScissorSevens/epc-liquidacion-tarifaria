# Memo de entrega — Sistema de Liquidación Tarifaria EPC

**Fecha de entrega:** agosto de 2026
**Sistema:** `epc-liquidacion-tarifaria` (Sistema de Liquidación Tarifaria para Empresas Públicas de Cundinamarca)
**Stack:** TypeScript + Expo SDK 54 (React Native) + .NET 8 (Minimal API) + PostgreSQL 16 + SQLite

---

## Propósito

Este memo resume el estado del proyecto al momento de la entrega al equipo de EPC para que el siguiente ingeniero pueda continuar el trabajo sin tener que reconstruir el contexto desde cero. Para información detallada, referirse a los documentos en `docs/` listados al final.

---

## Estado actual (al cierre de esta entrega)

- **Tests automatizados:** 2123/2123 verde en 171 suites, ejecutados con `npm test` desde la raíz (delega al workspace `mobile`).
- **Type check:** `tsc --noEmit` sin errores.
- **Compliance CRA 825/2017:** 8 de 10 gaps cerrados a lo largo de 3 SDDs archivadas (`param-tarifa-res-825-compliance-phase1`, `phase2`, `param-tarifa-residuales-cra-825`). Los 2 gaps diferidos están documentados y mapeados a cambios futuros (`auditoria-mejorada-cra-825`, `agente-validacion-cra-825`).
- **Branches activas:** `main` (consolidada), `desarrollo` (integración continua), `merge-desarrollo` (limpieza pendiente de cerrar). Las decisiones se registran con flujo SDD: `proposal → specs → design → tasks → apply → verify → archive`.

---

## Lo primero que tenés que hacer

1. **Levantar el proyecto end-to-end.** Seguir `docs/SETUP.md` (raíz del repo, sección "Setup local completo"). El proceso está probado en este proyecto y documentado con los flags exactos que evitan warnings y caches stale.
2. **Correr la suite completa de tests** con `npm test` desde la raíz. Si pasa, el setup está OK.
3. **Leer la arquitectura** en `docs/ARCHITECTURE.md` para entender cómo se compone el sistema (dominio puro compartido, mobile Expo, backend .NET, dashboard HTML).
4. **Revisar el estado detallado y las issues conocidas** en `docs/PROJECT_STATUS.md`. Ahí está la lista completa de gaps diferidos, optimizaciones pendientes y consideraciones técnicas.

---

## Decisiones arquitectónicas clave que tenés que conocer

Estas decisiones NO son negociables sin antes leer el rationale; cambiarlas rompe invariants en otras partes del sistema.

1. **El dominio es compartido entre mobile y (futuro) otros clientes.** Vive dentro de `mobile/src/` como TypeScript puro sin dependencias de framework. NO duplicar lógica de cálculo en backend .NET. Si hace falta lógica nueva del dominio, va en `mobile/src/` y se importa.
2. **Backend NO hashea contraseñas.** El cliente mobile hashea con SHA-256 antes del POST. Esto es por diseño (el backend usa un hash que ya viene del cliente). NO agregar bcrypt al backend sin migrar también al cliente.
3. **Mobile es offline-first.** La captura de lecturas, fotos y verificación de estrato funciona sin internet. La sincronización contra el backend es **manual** (el operario la dispara desde la pantalla Sync). NO asumir push automático.
4. **Multi-tenant por `id_prestador`.** Cada operario entra a su prestador y todas las tablas tienen FK `id_prestador`. NO agregar datos globales sin filtrar por prestador.
5. **Strict TDD mode activo.** Todo cambio sigue RED → GREEN → REFACTOR. Cada test rojo se commitea antes del feature. NO saltar pasos.
6. **Conventional commits en inglés** (subject ≤ 50 caracteres), sin `Co-Authored-By`, sin emojis.

---

## Compliance CRA 825/2017 — qué se hizo y qué falta

**Cerrado (8 gaps):**

- Fórmula CF corregida
- CMAA (inversiones ambientales) con flag `aplica_cmaa` opt-in explícito
- `validarAmbito` y `validarCmogMinimo`
- CMA mínimo vital (Opción A unificada)
- IPC editable con año base 2016
- `Acuerdo.estado` + `estado_verificacion`
- 3 campos de docs adicionales
- Migración 030 aditiva idempotente

**Diferido explícitamente (2 gaps):**

- **GAP-6:** MetadataCalculo completo §11 (20+ campos) — cambio dedicado: `auditoria-mejorada-cra-825`
- **GAP-10:** Contrato de salida del agente IA §12 — cambio dedicado: `agente-validacion-cra-825`

---

## Métricas finales del proyecto

| Métrica | Valor |
|---|---|
| Tests automatizados | 2123 verde (171 suites) |
| Cobertura | por archivo, ver reporte en `coverage/` |
| Archivos del dominio | repartidos en `mobile/src/` (módulos por dominio) |
| Pantallas mobile | `mobile/src/pantallas/` |
| Persistencia local | SQLite (`expo-sqlite` + `better-sqlite3` en tests) |
| Persistencia servidor | PostgreSQL 16 |
| Sync | manual desde pantalla Sync, protocolo idempotente con `sync_registros` |
| Branches | `main` + `desarrollo` + `merge-desarrollo` (cleanup pendiente) |
| SDDs archivados | 22+ en `openspec/changes/archive/` |

---

## Documentación disponible

Toda la documentación vive en la raíz del repo o bajo `docs/`:

- `README.md` — overview del proyecto, stack, comandos principales
- `HANDOFF.md` — este memo
- `docs/ARCHITECTURE.md` — arquitectura detallada por componente (dominio, mobile, backend, dashboard, motor CRA, sync, modelo de datos)
- `docs/SETUP.md` — cómo levantar dev local end-to-end
- `docs/CONVENTIONS.md` — convenciones del proyecto (código, commits, branches, SDD)
- `docs/PROJECT_STATUS.md` — estado detallado, gaps diferidos, issues conocidos, optimizaciones pendientes
- `docs/TESTING.md` — cómo correr y escribir tests, patrón TDD-strict, mocks comunes
- `docs/manual-tecnico-epc.tex` — manual técnico formal en LaTeX (compilable a PDF vía Overleaf)

Para normativa CRA original, ver `Documentos/Normativa-CRA/`.

---

## Riesgos y cosas a mirar con cuidado

1. **Token de sesión es fake.** El token actual es `fake-token-{timestamp}` con expiración hardcoded a 24 horas. NO usar este token como mecanismo de seguridad en producción. La fase siguiente es un GUID generado por backend .NET con `expiresAt` validado contra PostgreSQL.
2. **Cobertura local del dominio tiene un residuo histórico.** Existe un directorio `src/__tests__/` en la raíz que es leftover del SDD `delete-legacy-src-mirror`. NO contiene tests activos, pero es ruido. Considerar agregar a `.gitignore` o borrar.
3. **El motor CRA aplica normativa rural** (<5000 suscriptores, Res CRA 825/2017 + 907/2019 + 750/2016). NO aplica para prestadores urbanos ni para Res CRA 1032/2026 (vigente desde 24/03/2026).
4. **Backend NO se deployó todavía.** Está configurado para dev local (`http://<IP-servidor>:5180`). NO hay pipeline de CI/CD productivo ni configuración de hosting. Esta decisión queda para EPC.
5. **Compliance 8/10 = NO completo.** Los 2 gaps diferidos son cambios dedicados futuros. NO dar por cerrado el compliance hasta que esos 2 se aborden.

---

## Próximos pasos sugeridos (no urgentes)

1. Cerrar la branch `merge-desarrollo` local y remote (cleanup puro, ya mergeada a main).
2. Abordar GAP-6 (`auditoria-mejorada-cra-825`) y GAP-10 (`agente-validacion-cra-825`) cuando el equipo lo priorice.
3. Migración del token fake-token a GUID real con expiración validada contra PostgreSQL.
4. Pipeline CI/CD productivo para backend .NET (actualmente solo mobile está automatizado).
5. Evaluar el SDD activo `factura-compliance-fase1` y `factura-compliance-polish` en `openspec/changes/`.

---

## Antes de hacer cualquier cambio

1. **Leé el HANDOFF completo** (este documento).
2. **Leé `docs/PROJECT_STATUS.md`** para entender qué está activo y qué está diferido.
3. **Leé el proposal del cambio** si vas a abrir un nuevo SDD. El flujo está documentado en `docs/CONVENTIONS.md` sección "SDD workflow".
4. **Hablá con el equipo de EPC** para alinear prioridades antes de proponer nuevos cambios.
