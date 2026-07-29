# Spec: Snapshot de Factura según Res CRA 1038/2026

**Capability:** `factura-snapshot-1038`
**Change:** `factura-compliance-fase1`

## Purpose

Garantizar que la factura móvil emitida desde la app (offline) cumpla los requisitos de la **Resolución CRA 1038 de 2026** sobre datos mínimos del prestador, suscriptor, lectura, otros valores, código de verificación, referencia de pago y QR de banca virtual, sin invalidar la firma de facturas históricas (compatibilidad hash v1 ↔ v2).

## Requirements

### R1 — Snapshot del Prestador (8 campos)

El `FacturaSnapshotPrestador` DEBE contener exactamente 8 campos, todos `readonly`:

- `id_prestador: number`
- `codigo: string`
- `nombre: string`
- `nit: string`
- `municipio: string`
- `departamento: string`
- `representante_legal: string | null`
- `representante_legal_cedula: string | null`

`representante_legal` y `representante_legal_cedula` admiten `null` cuando el origen no los trae (legado, captura incompleta). El snapshot NUNCA omite la clave — siempre la expone, con `null` si falta.

#### Scenario: emitir factura con prestador completo preserva los 8 campos

- **WHEN** se invoca `emitirFactura(input, hasher)` con un `Prestador` cuyos 8 campos tienen valor
- **THEN** `factura.snapshot.prestador` contiene exactamente esos 8 campos, deepFrozen

#### Scenario: representante_legal y representante_legal_cedula null se preservan como null (no undefined, no se omiten)

- **WHEN** el `Prestador` origen no trae `representante_legal` ni `representante_legal_cedula`
- **THEN** `factura.snapshot.prestador.representante_legal === null`
- **AND** `factura.snapshot.prestador.representante_legal_cedula === null`

### R2 — Snapshot del Suscriptor (14 campos con null explícito)

El `FacturaSnapshotSuscriptor` DEBE contener 14 campos, todos `readonly`:

- `codigo: string`
- `nombre_apellidos: string`
- `cedula: string`
- `email: string | null`
- `telefono: string | null`
- `municipio: string`
- `sector: string | null`
- `calle: string | null`
- `direccion: string`
- `estrato: 1 | 2 | 3 | 4 | 5 | 6`
- `estado: 'activo' | 'suspendido' | 'facturado'`
- `matricula_inmobiliaria: string | null`
- `numero_catastral: string | null`
- `id_prestador: number`
- `categoria_uso: 'residencial' | 'comercial' | 'industrial' | 'oficial' | 'especial'`

Los campos opcionales DEBEN usar `null` (NO `undefined`, NO omitir la clave) cuando el origen no los trae. `estado` se denormaliza del origen para auditoría histórica.

#### Scenario: snapshot preserva los 14 campos del suscriptor activo

- **WHEN** se invoca `emitirFactura(input, hasher)` con un `Suscriptor` activo completo
- **THEN** `factura.snapshot.suscriptor` contiene los 14 campos

#### Scenario: campos opcionales son null (no undefined) cuando faltan

- **WHEN** el `Suscriptor` origen no trae email, telefono, sector, calle, matricula_inmobiliaria, numero_catastral
- **THEN** cada uno de esos campos es `null` en el snapshot (NO `undefined`, NO ausente)

### R3 — Snapshot de la Lectura (7 claves planas)

El `FacturaSnapshotLectura` DEBE contener exactamente 7 claves planas (NO objeto `evidencia` anidado), todos `readonly`:

- `lectura_actual: number`
- `lectura_anterior: number`
- `estado_validacion: 'pendiente' | 'validado' | 'error'`
- `evidencia_foto_path: string | null`
- `evidencia_foto_hash: string | null`
- `timestamp_captura: string` (ISO 8601)
- `observaciones: string | null`

`evidencia_foto_path` y `evidencia_foto_hash` son `null` cuando el origen no trae foto. `observaciones` es `null` cuando no hay notas.

#### Scenario: snapshot aplana evidencia a claves top-level

- **WHEN** el origen tiene `evidencia: { foto_path, foto_hash }`
- **THEN** el snapshot tiene `evidencia_foto_path` y `evidencia_foto_hash` planas, NO `evidencia` anidada

#### Scenario: snapshot tiene exactamente 7 claves

- **WHEN** se emite una factura
- **THEN** `Object.keys(factura.snapshot.lectura).length === 7`

### R4 — Validación de catálogo de otros valores

`emitirFactura` DEBE validar que cada `OtroValor` en `input.otrosValores` tiene un `concepto` registrado en `OtrosValoresCatalogo` antes de copiar al snapshot. Si algún concepto NO está en el catálogo, DEBE lanzar `Error(MENSAJES_ERROR_FACTURA.CONCEPTO_NO_AUTORIZADO)`.

#### Scenario: emitir con concepto fuera del catálogo lanza error

- **WHEN** se invoca `emitirFactura` con un `OtroValor` cuyo `concepto` no está en `OtrosValoresCatalogo`
- **THEN** la función lanza `Error(MENSAJES_ERROR_FACTURA.CONCEPTO_NO_AUTORIZADO)`

### R5 — Total negativo se rechaza

`calcularTotalFactura` DEBE lanzar `Error(MENSAJES_ERROR_FACTURA.TOTAL_NEGATIVO_NO_PERMITIDO)` cuando el total calculado (suma de `liquidacion.total + sum(otros_valores) + saldo_anterior`) es < 0.

#### Scenario: total negativo (post suma) se rechaza

- **WHEN** la factura tiene `liquidacion.total = 100`, `otros_valores = []`, `saldo_anterior = -500`
- **THEN** `calcularTotalFactura(factura)` lanza `Error(MENSAJES_ERROR_FACTURA.TOTAL_NEGATIVO_NO_PERMITIDO)`

### R6 — Código de verificación: 10 chars base36

`calcularCodigoVerificacion(factura)` DEBE retornar un string de exactamente 10 caracteres en base36 (`0-9`, `A-Z`).

Algoritmo:
1. Filtrar solo chars hex del hash (`[0-9a-fA-F]`).
2. Tomar los primeros 16 chars hex.
3. Convertir a entero sin signo.
4. Codificar en base36.
5. PadStart con `'0'` a longitud 10.

#### Scenario: codigo tiene longitud 10 y solo base36

- **WHEN** se calcula el código de una factura con hash SHA-256 real
- **THEN** el código tiene longitud 10
- **AND** todos los chars son `[0-9A-Z]`

#### Scenario: codigo es determinista (misma factura → mismo codigo)

- **WHEN** se invoca `calcularCodigoVerificacion` dos veces con la misma factura
- **THEN** ambos retornos son idénticos

### R7 — Referencia de pago: `{prestador}-{periodo}-{consecutivo}-{checksum}`

`generarReferenciaPago(factura, consecutivo, hasher)` DEBE retornar un string con exactamente 4 segmentos separados por `-`:

- segmento 1: `id_prestador` (string del número).
- segmento 2: `id_periodo` (formato YYYYMM).
- segmento 3: `consecutivo` (string del número).
- segmento 4: `checksum` (4 chars base36 derivados de SHA-256 sobre `${id_prestador}-${id_periodo}-${consecutivo}`).

#### Scenario: referencia tiene formato exacto

- **WHEN** se genera con `id_prestador=1`, `id_periodo='202601'`, `consecutivo=1`
- **THEN** retorna `1-202601-1-XXXX` donde `XXXX` son 4 chars base36

#### Scenario: misma tripla produce misma referencia (determinista)

- **WHEN** se invoca dos veces con la misma (id_prestador, id_periodo, consecutivo)
- **THEN** ambas referencias son idénticas

### R8 — QR con 4 campos JSON

`generarQrPago(factura)` DEBE retornar un string JSON con exactamente 4 campos canónicos:

- `codigo_verificacion: string` (10 base36)
- `valor_total: number` (en pesos)
- `fecha_emision: string` (ISO 8601 YYYY-MM-DD)
- `referencia_pago: string` (formato R7)

El JSON se serializa en orden canónico explícito.

#### Scenario: QR es JSON parseable con 4 campos exactos

- **WHEN** se genera el QR de una factura
- **THEN** `JSON.parse(qr)` retorna un objeto con exactamente 4 claves
- **AND** `Object.keys(parsed).sort()` coincide con `['codigo_verificacion', 'fecha_emision', 'referencia_pago', 'valor_total']`

#### Scenario: QR es determinista

- **WHEN** se genera el QR dos veces con la misma factura
- **THEN** ambos retornos son idénticos

### R9 — Verificación de integridad con compatibilidad v1 ↔ v2

`verificarIntegridadFactura(factura, hasher)` DEBE detectar la versión por `snapshot.metadata.hash_version` y aplicar el algoritmo correcto:

- `v2`: payload extendido (incluye `prestador`, `otros_valores`, `saldo_anterior`, `metadata`).
- `v1`: payload retrocompatible (sin `prestador`, sin `metadata`, sin `otros_valores`/`saldo_anterior`).

Retorna `true` si el hash de la factura coincide con el recalculado, `false` si fue alterada.

#### Scenario: factura v2 recién emitida verifica true

- **WHEN** se invoca `verificarIntegridadFactura(factura, hasher)` sobre una factura emitida por `emitirFactura`
- **THEN** retorna `true`

#### Scenario: factura v1 legacy verifica true con su firma v1 original

- **WHEN** se construye una factura con `metadata.hash_version: 'v1'` y `hash` calculado con el algoritmo v1 (payload reducido)
- **THEN** `verificarIntegridadFactura` retorna `true`

#### Scenario: mutación de cualquier campo del snapshot v2 invalida la firma

- **WHEN** se modifica la cédula del suscriptor en una factura v2
- **THEN** `verificarIntegridadFactura` retorna `false`

### R10 — Persistencia cablea 4 columnas (migration 020)

Los adapters de persistencia (`factura-repository-sqlite.ts` y `factura-repository-expo-sqlite.ts`) DEBEN cablear las 4 columnas de migration 020 (`codigo_verificacion`, `referencia_pago`, `qr_pago`, `version_tarifa_aplicada`) en `FacturaRow`, `SQL_INSERT`, `toRow()` y `fromRow()`.

#### Scenario: round-trip preserva los 4 campos de migration 020

- **WHEN** se invoca `repo.crear(factura)` y luego `repo.buscarPorId(factura.id)`
- **THEN** la factura recuperada tiene `codigo_verificacion`, `referencia_pago`, `qr_pago`, `version_tarifa_aplicada` idénticos a los del input

### R11 — Determinismo via Clock

`emitirFactura(input, hasher, idGen?, clock?)` DEBE aceptar un `Clock` opcional para derivar campos dependientes del tiempo. Si no se inyecta, usa `relojSistema` (default).

#### Scenario: emitirFactura con clock fijo produce codigo_verificacion determinista

- **WHEN** se invoca `emitirFactura(input, hasher, undefined, relojFijo('2026-02-01T10:00:00.000Z'))` dos veces con el mismo input
- **THEN** ambas facturas tienen el mismo `codigo_verificacion` y `hash`

### R12 — corregirFactura regenera pagos

`corregirFactura(input, hasher, idGen?)` DEBE regenerar `codigo_verificacion`, `referencia_pago`, `qr_pago`, `version_tarifa_aplicada` del nuevo borrador con el nuevo número de factura y la nueva liquidación.

#### Scenario: nuevoBorrador tiene codigo_verificacion distinto al original

- **WHEN** se invoca `corregirFactura` con `consecutivoNuevo=99` (distinto al original)
- **THEN** `nuevoBorrador.codigo_verificacion !== facturaOriginal.codigo_verificacion`
- **AND** `nuevoBorrador.referencia_pago` (si idGen inyectado) refleja el nuevo consecutivo

## Compliance matrix

| # | Requirement | Escenarios | Estado |
|---|-------------|-----------:|--------|
| R1 | Snapshot Prestador 8 campos + null support | 2 | ✅ |
| R2 | Snapshot Suscriptor 14 campos + null explícito | 2 | ✅ |
| R3 | Snapshot Lectura 7 claves planas + estado_validacion | 2 | ✅ |
| R4 | Validación catálogo otros valores | 1 | ✅ |
| R5 | Total negativo rechazado | 1 | ✅ |
| R6 | Código verificación 10 base36 | 2 | ✅ |
| R7 | Referencia formato {prestador}-{periodo}-{consecutivo}-{checksum} | 2 | ✅ |
| R8 | QR JSON 4 campos | 1 | ✅ |
| R9 | VerificarIntegridadFactura v1 + v2 | 2 | ✅ |
| R10 | Repository cablea migration 020 | 1 | ✅ |
| R11 | Clock inyectable | 1 | ✅ |
| R12 | corregirFactura regenera pagos | 1 | ✅ |

**Total:** 18 escenarios, todos con tests que verifican el THEN exacto del spec.
