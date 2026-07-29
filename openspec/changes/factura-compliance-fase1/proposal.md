# Proposal: `factura-compliance-fase1`

## Why

La factura móvil ya persiste un `snapshot` JSON con datos del suscriptor/medidor/periodo/operario, pero le faltan los datos exigidos por **Res CRA 1038/2026** para presentar y verificar la factura:

1. **Datos del prestador que emite la factura** — Res 1038 §1.
2. **Datos de la lectura que origina la liquidación** — Res 1038 §3 y §10.
3. **Otros valores + saldo anterior** — Res 1038 §4 (otros conceptos a cobrar/deducir).
4. **Código de verificación público, referencia de pago y QR para banca virtual** — Res 1038 §7 y §10.
5. **Compatibilidad con facturas históricas (hash v1)** — no invalidar firmas existentes.

El factory actual NO proyecta estos campos en el snapshot, el repository los persiste solo en JSON (no consultables), y los helpers de pago (codigo/referencia/QR) no cumplen el contrato normativo (16 hex chars, UUID en lugar de formato derivado, pipe-string en lugar de JSON).

## What changes

### Dominio (TDD strict por concern)

- `mobile/dominio/factura/types.ts`: extender `FacturaSnapshot` con `prestador`, `lectura`, `otros_valores`, `saldo_anterior`, `metadata`. Shape normativo de 8 campos en `FacturaSnapshotPrestador` (incluye `representante_legal_cedula` con null support) y 14 campos en `FacturaSnapshotSuscriptor` (incluye `estado` y opcionales con null explícito en vez de undefined).
- `mobile/dominio/factura/factura.ts`: construir snapshot v2, payload canónico v2 con prestador, validación de catálogo en `emitirFactura` (frontera publica), rechazo de total negativo en `calcularTotalFactura`.
- `mobile/dominio/factura/otros-valores-catalogo.ts`: catálogo constante de 7 conceptos Res CRA 1038/2026 con helper `crearOtroValor` (validación de catálogo, glosa requerida).
- `mobile/dominio/factura/pagos.ts`: helpers puros reescritos para cumplir contrato normativo:
  - `calcularCodigoVerificacion`: SHA-256 + 16 hex chars → base36, primeros **10 chars**.
  - `generarReferenciaPago`: formato **`{id_prestador}-{id_periodo}-{consecutivo}-{checksum}`** (NO UUID).
  - `generarQrPago`: JSON con 4 campos (codigo_verificacion, valor_total, fecha_emision, referencia_pago).
- `mobile/dominio/factura/factura.ts`: helper `verificarIntegridadFactura(factura, hasher)` que detecta `metadata.hash_version` y aplica algoritmo v1 (retrocompatible) o v2 (extendido).

### Persistencia

- `mobile/dominio/persistencia/sqlite/migrations/020_factura_compliance_1038.sql`: agregar 4 columnas nullable (`codigo_verificacion`, `referencia_pago`, `qr_pago`, `version_tarifa_aplicada`) + índice UNIQUE sobre `referencia_pago`.
- `mobile/src/persistencia/expo-sqlite/migraciones.ts`: espejo de la migration 020 con registro en `__migraciones_aplicadas`.
- `mobile/dominio/factura/factura-repository-sqlite.ts` y espejo `mobile/src/persistencia/expo-sqlite/factura-repository-expo-sqlite.ts`: cablear las 4 columnas al `FacturaRow`, `SQL_INSERT`, `toRow()` y `fromRow()`. Fallback a derivación desde hash/snapshot para filas legacy pre-2027.

### UI administrativa

- `mobile/src/pantallas/admin/OtrosValoresFactura.tsx`: pantalla CRUD/lista editable para gestionar `otros_valores` y `saldo_anterior` desde un operario admin. Controles accesibles con touch targets ≥ 44px (WCAG 2.5.5).

### Determinismo

- Puerto `Clock` inyectable en `emitirFactura` (default `relojSistema`, test `relojFijo`). Permite reproducir timestamp-dependent fields de forma determinista en tests.

### Corrección

- `corregirFactura` regenera `codigo_verificacion`, `referencia_pago`, `qr_pago`, `version_tarifa_aplicada` con el nuevo número de factura y la nueva liquidación. Antes heredaba los del original — inconsistencia detectable por un auditor.

## Approach

13 commits atómicos, TDD strict (RED → GREEN → TRIANGULATE por concern):

1. `fix(factura): snapshot prestador with representante_legal_cedula + null support`
2. `fix(factura): snapshot suscriptor with estado + explicit null opcionales`
3. `fix(factura): snapshot lectura with estado_validacion + flat evidencia keys`
4. `fix(factura): emitirFactura validates otros_valores against catálogo`
5. `fix(factura): calcularTotalFactura rejects total negativo`
6. `fix(factura): codigo_verificacion is 10-char base36 from SHA-256`
7. `fix(factura): referencia_pago is {prestador}-{periodo}-{consecutivo}-{checksum}`
8. `fix(factura): qr_pago is JSON with 4 mandatory fields`
9. `fix(factura): helper verificarIntegridadFactura supports v1 + v2`
10. `fix(factura): repository wires codigo_verificacion + referencia_pago + qr_pago + version_tarifa_aplicada columns`
11. `chore(factura): deterministic Clock + corregirFactura recalcula pagos + Clock tests`
12. `docs(compliance): refresh proposal.md + add tasks.md + add specs/factura-snapshot-1038/spec.md`

> La propuesta original mencionaba 7 commits sin UI ni migration. El design evolucionó a 10 commits (incluyendo migration 020 y UI admin), y la verify fase pidió fix-and-reverify con 11 CRITICAL. Total actual: 13 commits (10 originales + 3 del fix-reverify, este último combinando payments y verificación de integridad).

## Non-goals

- Cambios en el motor tarifario.
- Cambios en entidades origen (Suscriptor, Medidor, Operario, Lectura).
- Cambios en backend .NET o espejo `src/`.
- VB/VC/VS, mínimo vital, subsidios discriminados, catálogo dinámico de otros valores.
- Hash v3 — la compatibilidad es solo v1 ↔ v2.
