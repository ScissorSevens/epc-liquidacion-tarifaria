# Tasks: `factura-compliance-fase1`

## Phase 1: Snapshot expansion (prestador, suscriptor, lectura)

- [x] 1.1 Extender `FacturaSnapshotPrestador` a 8 campos (incluye `representante_legal_cedula` con null support)
- [x] 1.2 Extender `FacturaSnapshotSuscriptor` con `estado` + opcionales `null` en vez de `undefined`
- [x] 1.3 Extender `FacturaSnapshotLectura` con `estado_validacion` + aplanar `evidencia` a claves top-level planas

## Phase 2: otros_valores + saldo_anterior

- [x] 2.1 Crear `mobile/dominio/factura/otros-valores-catalogo.ts` con 7 conceptos Res CRA 1038/2026
- [x] 2.2 Helper `crearOtroValor` con validación de catálogo, glosa requerida
- [x] 2.3 Integrar `otrosValores` y `saldoAnterior` en `emitirFactura` snapshot
- [x] 2.4 Validación de frontera: `emitirFactura` rechaza `otrosValores` con concepto fuera del catálogo (`CONCEPTO_NO_AUTORIZADO`)

## Phase 3: Total + helpers de pago

- [x] 3.1 `calcularTotalFactura` rechaza total negativo (`TOTAL_NEGATIVO_NO_PERMITIDO`)
- [x] 3.2 Reescribir `calcularCodigoVerificacion`: 10 chars base36 desde SHA-256
- [x] 3.3 Reescribir `generarReferenciaPago`: formato `{prestador}-{periodo}-{consecutivo}-{checksum}`
- [x] 3.4 Reescribir `generarQrPago`: JSON con 4 campos (codigo_verificacion, valor_total, fecha_emision, referencia_pago)
- [x] 3.5 Agregar `esCodigoVerificacionValido` como guard del formato normativo

## Phase 4: Compatibilidad hash v1 ↔ v2

- [x] 4.1 Helper `verificarIntegridadFactura(factura, hasher)` que detecta `metadata.hash_version` y aplica el algoritmo correcto
- [x] 4.2 Tests con fixture de Factura v1 legacy verifican true con su firma original

## Phase 5: Persistencia — migration 020

- [x] 5.1 Crear `mobile/dominio/persistencia/sqlite/migrations/020_factura_compliance_1038.sql` con 4 columnas + índice UNIQUE
- [x] 5.2 Espejo en `mobile/src/persistencia/expo-sqlite/migraciones.ts`
- [x] 5.3 Cablear las 4 columnas en `FacturaRow`, `SQL_INSERT`, `toRow`, `fromRow` (ambos adapters)
- [x] 5.4 Tests de round-trip preservan las 4 columnas en INSERT + SELECT

## Phase 6: UI administrativa (admin)

- [x] 6.1 Crear `mobile/src/pantallas/admin/OtrosValoresFactura.tsx` con lista editable de `otros_valores` y `saldo_anterior`
- [x] 6.2 Touch targets ≥ 44px (WCAG 2.5.5)
- [x] 6.3 Validación de catálogo + glosa requerida para conceptos que lo exigen

## Phase 7: Determinismo + corrección

- [x] 7.1 Puerto `Clock` inyectable en `emitirFactura` (default `relojSistema`, test `relojFijo`)
- [x] 7.2 `corregirFactura` regenera `codigo_verificacion`, `referencia_pago`, `qr_pago`, `version_tarifa_aplicada` con el nuevo número de factura y la nueva liquidación

## Phase 8: Artifacts y docs

- [x] 8.1 Crear `proposal.md` con el approach final (13 commits)
- [x] 8.2 Crear `tasks.md` (este archivo)
- [x] 8.3 Crear `specs/factura-snapshot-1038/spec.md`

## Quality gates

- [x] Tests: 1451 passing (de 1406 baseline → +45 escenarios)
- [x] TypeScript: sin errores (`tsc --noEmit` exit 0)
- [x] No `expect(true).toBe(true)` ni tautologías
- [x] Cada test verifica el THEN exacto del spec
- [x] Working tree: solo cambios intencionales
