# Arquitectura del Sistema

**Versión:** 1.1
**Última actualización:** agosto de 2026
**Aplica a:** commit `f8bf4fd` (branch `docs/handoff-epc-2026-08`)

---

## Tabla de Contenidos

1. Visión general y principio arquitectónico
2. Componentes del sistema
3. Dominio puro (TypeScript compartido)
4. Aplicación móvil (Expo + React Native)
5. Backend (API REST .NET)
6. Dashboard web
7. Motor tarifario CRA
8. Protocolo de sincronización offline
9. Modelo de datos
10. Decisiones arquitectónicas clave

---

## 1. Visión general y principio arquitectónico

El **Sistema de Liquidación Tarifaria EPC** es una solución full-stack para prestadores rurales de acueducto en Colombia. Su propósito es automatizar la captura de lecturas de medidores en campo (modo offline) y el cálculo de liquidaciones tarifarias según la normativa CRA vigente para prestadores rurales con menos de 5000 suscriptores.

### Principio arquitectónico central: separación de capas estricta

1. **Dominio puro:** lógica de negocio en TypeScript puro, sin dependencias de framework, plataforma ni base de datos. Compartido entre mobile y (en el futuro) otros clientes.
2. **Puertos (interfaces):** contratos que el dominio expone para acceso a datos.
3. **Adaptadores:** implementaciones concretas de los puertos para cada plataforma (`expo-sqlite` para mobile, EF Core para el servidor).
4. **UI (Pantallas):** únicamente presentación; no contiene lógica de negocio.

**Implicancia práctica:** si una regla de cálculo cambia, se modifica una sola vez en `mobile/src/{modulo}/` y se propaga automáticamente. NO duplicar lógica entre capas.

### Stack tecnológico

| Capa | Tecnología |
|---|---|
| Lenguaje núcleo | TypeScript 5/6 strict |
| Workspaces | npm workspaces (monorepo) |
| Dominio puro + repos | TypeScript + Jest 30 + ts-jest 29 |
| Aplicación móvil | React Native 0.81 + Expo SDK 54 + React 19.1 + expo-router 6 + expo-sqlite 16 |
| Estado móvil | Zustand 5 |
| UI móvil | react-native-paper 5 |
| Hardware móvil | expo-camera, react-native-ble-plx (Bluetooth impresión) |
| Backend | .NET 8, ASP.NET Core Minimal API, EF Core 8 |
| Base de datos servidor | PostgreSQL 16 |
| Base de datos local mobile | SQLite (expo-sqlite) |
| Base de datos local backend | better-sqlite3 (Node.js, en tests) |
| Dashboard | HTML5 + Vanilla JS + bcrypt.js (cliente) |
| Especificación | OpenSpec + Engram (memoria persistente cross-session) |
| Testing mobile | jest-expo + @testing-library/react-native |

---

## 2. Componentes del sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                     Dispositivo móvil (Android)                 │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Aplicación Expo / React Native              │   │
│  │                                                         │   │
│  │  Pantallas (UI presentacional)                          │   │
│  │   │ usa                                                 │   │
│  │  Composición (bootstrap, DI, getBootstrap)              │   │
│  │   │ usa puertos del dominio                             │   │
│  │  Dominio puro TypeScript compartido                    │   │
│  │   │ usa interfaces de persistencia                     │   │
│  │  Adaptadores expo-sqlite (repositorios)                │   │
│  │   │ usa                                                │   │
│  │  SQLite local (expo-sqlite)                            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS (sync manual, cuando hay WiFi)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Servidor (red LAN del prestador)            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            MediApp.Api (.NET 8 Minimal API)              │  │
│  │                                                          │  │
│  │  /api/v1/suscriptores  /api/v1/medidores                │  │
│  │  /api/v1/lecturas      /api/v1/liquidaciones            │  │
│  │  /api/v1/operarios     /health                          │  │
│  │                                                          │  │
│  │  wwwroot/ (Dashboard HTML estático)                     │  │
│  └────────────────────────────┬─────────────────────────────┘  │
│                               │ EF Core + Npgsql                │
│                               ▼                                 │
│                    ┌──────────────────┐                        │
│                    │   PostgreSQL 16  │                        │
│                    └──────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Dominio puro (TypeScript compartido)

**Ubicación:** `mobile/src/{modulo}/`

El dominio es **TypeScript puro, sin dependencias de framework**, plataforma ni base de datos. Puede ejecutarse en React Native, Node.js (tests) o un navegador web (futuro).

### Módulos del dominio

| Módulo | Responsabilidad |
|---|---|
| `motor-tarifario/` | Cálculo CRA: CF, CC, subsidios, validaciones |
| `parametros-tarifa/` | Dominio ParametrosTarifa + flag `aplica_cmaa` + IPC editable |
| `acuerdo-municipal/` | AcuerdoMunicipal + estado ciclo de vida |
| `suscriptores/` | Suscriptores + verificación de estrato |
| `medidores/` | Medidores |
| `lecturas/` | Lecturas |
| `operarios/` | Operarios (admin + campo) |
| `prestadores/` | Prestadores (multi-tenant) |
| `factura/` | Factura + snapshot `validacion_ambito` |
| `importacion/` | Importación masiva desde CSV |
| `sincronizacion/` | Cola de sincronización offline |
| `captura-lecturas/` | Caso de uso: capturar lectura |
| `calculo/` | Cálculos auxiliares |
| `auditoria/` | Trazabilidad regulatoria |
| `persistencia/` | Adaptadores SQLite (integration tests) |
| `cliente-http/` | HTTP client para backend .NET |
| `categorias-uso/` | Categorías (residencial, comercial, etc.) |
| `periodos/` | Períodos de facturación |
| `componentes/` | Componentes auxiliares |
| `shared/` | Utilidades compartidas + ports |

### Tests colocados

Cada módulo tiene su `__tests__/` adyacente con tests unitarios. La estrategia es **tests colocados** (junto al código que prueban), no centralizados.

### Patrón de puertos y adaptadores

```typescript
// Puerto (interface en shared/ports/)
export interface ISuscriptorRepository {
  listar(): Promise<Suscriptor[]>;
  guardar(s: Suscriptor): Promise<void>;
  // ...
}

// Adaptador expo-sqlite (mobile/src/persistencia/expo-sqlite/)
export class SuscriptorRepositoryExpoSQLite implements ISuscriptorRepository {
  async listar(): Promise<Suscriptor[]> {
    const rows = await this.db.getAllAsync<SuscriptorRow>(...);
    return rows.map(rowToSuscriptor);
  }
  // ...
}
```

---

## 4. Aplicación móvil (Expo + React Native)

**Ubicación:** `mobile/`

### Stack específico

- **Expo SDK 54** + **React Native 0.81** + **React 19.1**
- **expo-router 6** para navegación file-based
- **expo-sqlite 16** para persistencia local
- **Zustand 5** para estado global
- **react-native-paper 5** para UI components
- **expo-camera** para captura de fotos
- **react-native-ble-plx** para impresión Bluetooth

> **Restricción importante:** `react-native-vector-icons` NO es compatible con Expo Go. Se usa exclusivamente `@expo/vector-icons`.

### Estructura

```
mobile/src/
├── pantallas/                  # Pantallas (ParametrosTarifa, RutaDeHoy, etc.)
├── persistencia/               # Repositorios expo-sqlite
├── composition/                # Bootstrap + inyección de dependencias
├── componentes/                # Componentes UI presentacionales
├── hooks/                      # Hooks custom (useParametrosFormState, etc.)
├── theme/                      # Tema y design tokens
├── adapters/                   # Adapters (Bluetooth, impresión)
└── navegacion/                 # Navegación + auth gate
```

### Pantallas principales

| Pantalla | Ruta | Descripción |
|---|---|---|
| RutaDeHoy | Inicio | Lista de suscriptores + progreso del día |
| CapturarLectura | Lecturas | Formulario de lectura |
| DetalleSuscriptor | Lecturas | Datos del suscriptor y medidor |
| ParametrosTarifa | Admin | Configuración de parámetros tarifarios (compuesto por 6 subcomponentes) |
| Sincronizacion | Sync | Panel de sync manual |
| Configuracion | Config | URL del backend |
| SetupInicial | Auth | Wizard 2 pasos (configurar prestador + crear admin) |
| Login | Auth | Validación cédula + password |

### Persistencia local (expo-sqlite)

Los repositorios en `mobile/src/persistencia/expo-sqlite/` implementan los puertos del dominio:

| Repositorio | Puerto implementado |
|---|---|
| `suscriptor-repository-expo-sqlite.ts` | `ISuscriptorRepository` |
| `lectura-repository-expo-sqlite.ts` | `ILecturaRepository` |
| `medidor-repository-expo-sqlite.ts` | `IMedidorRepository` |
| `operario-repository-expo-sqlite.ts` | `IOperarioRepository` |
| `factura-repository-expo-sqlite.ts` | `IFacturaRepository` |
| `cola-repository-expo-sqlite.ts` | `IColaRepository` |

Las migraciones de esquema SQLite se gestionan en `mobile/src/persistencia/expo-sqlite/migraciones.ts`.

### Composition Root (bootstrap)

`mobile/src/composition/bootstrap.ts` realiza la inyección de dependencias: instancia repositorios, el procesador de cola y el cliente HTTP, y los conecta al dominio puro.

```typescript
// Acceso desde cualquier pantalla:
const bootstrap = await getBootstrap();
const suscriptores = await bootstrap.suscriptorRepo.listar();
```

---

## 5. Backend (API REST .NET)

**Ubicación:** `backend/src/MediApp.Api/`

### Stack específico

- **.NET 8** + **ASP.NET Core Minimal API**
- **Entity Framework Core 8** + **Npgsql** (PostgreSQL)
- **EFCore.NamingConventions**: convención `snake_case` en todas las columnas y tablas
- **FluentValidation**: validación de payloads por feature
- **Serilog** (CompactJsonFormatter): logging estructurado JSON
- **Swagger / OpenAPI**: disponible solo en entorno `Development`

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Health check con ping a PostgreSQL |
| POST | `/api/v1/suscriptores` | Sync suscriptor desde mobile |
| GET | `/api/v1/suscriptores` | Listar suscriptores (dashboard) |
| POST | `/api/v1/medidores` | Sync medidor desde mobile |
| GET | `/api/v1/medidores` | Listar medidores (dashboard) |
| POST | `/api/v1/lecturas` | Sync lectura desde mobile (incluye foto) |
| GET | `/api/v1/lecturas` | Listar lecturas con medidor y suscriptor |
| POST | `/api/v1/liquidaciones` | Sync liquidación desde mobile |
| GET | `/api/v1/liquidaciones` | Listar liquidaciones (dashboard) |
| POST | `/api/v1/operarios` | Crear operario (dashboard) |
| GET | `/api/v1/operarios` | Listar operarios |
| PUT | `/api/v1/operarios/{id}` | Actualizar operario |
| PATCH | `/api/v1/operarios/vincular-dispositivo` | Vincular dispositivo móvil |

### Organización por features

```
Features/
├── Operarios/
│   ├── OperariosEndpoints.cs    # Rutas CRUD + vincular dispositivo
│   ├── OperarioPayload.cs       # DTO de creación
│   ├── OperarioUpdatePayload.cs # DTO de actualización
│   ├── OperarioMapper.cs        # Payload → Entidad
│   └── OperarioValidator.cs     # Reglas FluentValidation
├── Suscriptores/               # Igual estructura
├── Medidores/                  # Igual estructura
├── Lecturas/                   # + manejo de foto base64
└── Liquidaciones/              # Igual estructura
```

### Seguridad de contraseñas

El backend **nunca hashea contraseñas**. El hash SHA-256 (mobile) o bcrypt (dashboard) se aplica en el cliente **antes** del POST. El campo `password_hash` nunca se retorna en ninguna response.

### Almacén de evidencias fotográficas

Las fotos de medidores se envían como base64 en el payload de lectura. El backend las guarda en disco a través de `IAlmacenEvidencias` / `AlmacenLocal`, y almacena solo la ruta relativa en la columna `evidencia_foto_ruta`.

### Protocolo SyncHandler

Los endpoints de sync (suscriptores, medidores, lecturas, liquidaciones) usan el handler genérico `SyncHandler.Handle<TPayload, TEntidad>` que implementa:

1. Validación del payload (FluentValidation)
2. Verificación de FK (ej. medidor existe antes de insertar lectura)
3. Búsqueda por `id_cliente` en `sync_registros`
4. Si existe → idempotente (200 OK sin modificar)
5. Si no existe → INSERT + registro en `sync_registros` (201 Created)

### Migraciones EF Core

| Migración | Descripción |
|---|---|
| `20260506171131_Inicial` | Estructura base: suscriptores, medidores, lecturas, liquidaciones, sync_registros |
| `20260506172434_ModeloCompleto` | Ajustes al modelo completo |
| `20260507145441_ReconciliarConDominioMobile` | Alineación con el dominio TypeScript |
| `20260510045654_AgregarOperarios` | Tabla operarios |

---

## 6. Dashboard web

**Ubicación:** `backend/src/MediApp.Api/wwwroot/index.html`

El dashboard es una **SPA estática** servida directamente por el backend ASP.NET Core (`UseStaticFiles` + `MapFallbackToFile`). No requiere npm, webpack ni ningún proceso de build.

### Características técnicas

- HTML5 + CSS3 + Vanilla JavaScript
- **bcrypt.js** cargado desde CDN: hash de contraseñas en el cliente (cost = 10) antes de enviar al backend
- Fetch API para comunicación con el backend REST
- Sin frameworks frontend (zero-dependency)

### Secciones del dashboard

1. **Operarios:** CRUD completo + vinculación de dispositivos
2. **Suscriptores:** consulta de todos los suscriptores sincronizados
3. **Lecturas:** consulta con datos del medidor y suscriptor
4. **Liquidaciones:** consulta de liquidaciones calculadas

---

## 7. Motor tarifario CRA

**Ubicación:** `mobile/src/motor-tarifario/motor-tarifario.ts`

El motor implementa la metodología tarifaria de la CRA para prestadores rurales:
- **Res CRA 825/2017** (base normativa)
- **Res CRA 907/2019** (CMAA + CMVIAA)
- **Res CRA 750/2016** (consumo básico por altitud)
- **Ley 142/1994 art. 99.6** (topes subsidios)

> **No aplica** a este proyecto: Res CRA 1032/2026 (vigente desde 24/03/2026) porque es para prestadores >5000 suscriptores urbanos.

### Función principal

```typescript
calcularLiquidacion(entrada: EntradaCalculo): ResultadoCalculo
```

### Parámetros de entrada (`EntradaCalculo`)

| Campo | Tipo | Descripción |
|---|---|---|
| `lecturaAnterior` | `number` | Lectura del período anterior (m³) |
| `lecturaActual` | `number` | Lectura del período actual (m³) |
| `estrato` | `Estrato` (1-6) | Estrato socioeconómico del suscriptor |
| `aplicaSubsidio` | `boolean` | Si aplica el factor de subsidio/contribución |
| `periodo` | `{mes, anio}` | Período de facturación |
| `parametros.cargoFijo` | `number` | CF mensual en pesos (puede ser 0 por mínimo vital) |
| `parametros.precioM3` | `number` | Precio del m³ en bloque básico |
| `parametros.precioM3Excedente` | `number` | Precio del m³ en bloque excedente |
| `parametros.consumoBasico` | `number` | Límite del bloque básico (varía con altitud) |
| `parametros.aplicaCmaa` | `boolean` | Opt-in para CMAA (inversiones ambientales) |

### Resultado (`ResultadoCalculo`)

| Campo | Descripción |
|---|---|
| `consumo` | Total consumido en m³ |
| `consumoBasico` | m³ en bloque básico |
| `consumoExcedente` | m³ por encima del límite básico |
| `cargoFijo` | CF redondeado al peso |
| `cargoConsumo` | Valor del bloque básico |
| `cargoExcedente` | Valor del bloque excedente |
| `subsidio` | Descuento por estrato 1-3 |
| `contribucion` | Recargo por estrato 5-6 |
| `total` | Valor final a cobrar |

### Fórmula

```
consumo = lecturaActual - lecturaAnterior
consumoBasico = min(consumo, limiteBasico)
consumoExcedente = max(consumo - limiteBasico, 0)

cargoConsumo = round(consumoBasico × precioM3)
cargoExcedente = round(consumoExcedente × precioM3Excedente)
cargoFijo = round(cargoFijoRaw)

// Factor de estrato (CRA 825/2017):
// E1: -60% | E2: -50% | E3: -40% | E4: 0% | E5: +50% | E6: +60%

// Subsidio (E1-E3): sobre CF + cargoConsumo
subsidio = round(|factor| × (cargoFijo + cargoConsumo))

// Contribución (E5-E6): sobre CF + consumo total
contribucion = round(factor × (cargoFijo + cargoConsumo + cargoExcedente))

// CMAA (opt-in): se agrega al total si aplicaCmaa = true
total = cargoFijo + cargoConsumo + cargoExcedente - subsidio + contribucion + cmAA
```

### Validaciones del motor

- Lecturas no pueden ser negativas
- Lectura actual ≥ lectura anterior
- Cargo fijo ≥ 0 (0 es válido por mínimo vital)
- Precio m³ y precio m³ excedente > 0
- Límite consumo básico > 0
- Estrato entre 1 y 6 (si se provee)
- Mes entre 1 y 12, año ≥ 2000

---

## 8. Protocolo de sincronización offline

### Modelo de cola

La cola de sincronización se gestiona en la tabla local `cola_sync` (SQLite). Cada item tiene:

| Campo | Descripción |
|---|---|
| `id` | UUID generado en el cliente |
| `tipo` | `suscriptor` \| `medidor` \| `lectura` \| `liquidacion` |
| `estado` | `PENDIENTE` \| `EXITOSO` \| `FALLIDO` |
| `intentos` | Número de intentos de envío |
| `dependeDe` | Array de IDs de items que deben sincronizarse primero |
| `ultimoError` | Último mensaje de error del servidor |
| `payload` | JSON con los datos a enviar |

### Orden de dependencias

La cola respeta el orden lógico de FK:

```
suscriptor → medidor → lectura → liquidacion
```

Un item de tipo `lectura` no se envía hasta que su `medidor` dependiente tenga estado `EXITOSO`.

### Protocolo de idempotencia (servidor)

El servidor mantiene la tabla `sync_registros` con los `id_cliente` ya procesados. Si llega un request con un `id_cliente` ya conocido:

- **200 OK** — no modifica nada, retorna el ID del servidor
- Si no existe → **201 Created** — inserta y registra

Esto permite reintentar cualquier sincronización fallida sin riesgo de duplicados.

### Identificador `id_cliente`

Formato: `{dispositivoId}:{idLocal}`

- `dispositivoId`: ID único del dispositivo Android (generado en primer arranque)
- `idLocal`: UUID generado al crear el registro offline

---

## 9. Modelo de datos

### Base de datos PostgreSQL (servidor)

6 tablas principales en snake_case:

| Tabla | Descripción |
|---|---|
| `suscriptores` | Usuarios del servicio de acueducto |
| `medidores` | Instrumentos de medición, FK → suscriptores |
| `lecturas` | Lecturas mensuales de medidores, FK → medidores |
| `liquidaciones` | Liquidaciones calculadas, FK → lecturas |
| `operarios` | Usuarios del sistema (administradores y operarios) |
| `sync_registros` | Registro de IDs de cliente ya sincronizados (idempotencia) |

Todas las tablas tienen FK `id_prestador` para multi-tenancy.

### Base de datos SQLite (dispositivo móvil)

Espejo del modelo PostgreSQL, adaptado para offline-first. Las columnas de fechas se almacenan como strings ISO 8601. Las migraciones están en `mobile/src/persistencia/expo-sqlite/migraciones.ts`.

### Multi-tenancy

Cada operario pertenece a un único prestador. El login valida cédula + password contra SQLite local y carga el `idPrestador` del operario. Toda la liquidación lleva FK `id_prestador`. NO hay datos globales sin filtrar.

---

## 10. Decisiones arquitectónicas clave

Estas decisiones tienen rationale detallado. NO cambiarlas sin antes leer el SDD archive correspondiente.

### 10.1 Dominio compartido entre mobile y (futuro) otros clientes

**Decisión:** todo el dominio vive dentro de `mobile/src/{modulo}/`. NO se duplica lógica en backend .NET.

**Rationale:** evita drift entre lo que calcula el mobile y lo que muestra el dashboard. Si la regla cambia, cambia en un solo lugar.

**Tradeoff:** el backend .NET NO tiene lógica de cálculo propia, solo persiste resultados que el mobile le envía.

### 10.2 Backend NO hashea contraseñas

**Decisión:** el cliente (mobile con SHA-256 o dashboard con bcrypt) hashea antes del POST. El backend solo valida.

**Rationale:** simplifica el backend y elimina un vector de ataque (el backend nunca ve la contraseña en claro). El cliente ya tiene el hash necesario para login offline.

**Tradeoff:** el hash está en el cliente, lo cual es un riesgo si el cliente es comprometido. Por eso el mobile usa SHA-256 (más débil) y el dashboard bcrypt (más fuerte).

### 10.3 Mobile offline-first con sync manual

**Decisión:** la captura funciona sin internet. La sincronización contra el backend es **manual** (el operario la dispara).

**Rationale:** los prestadores rurales tienen conectividad intermitente. Asumir conexión online es poco realista.

**Tradeoff:** requiere cola de sincronización con orden de dependencias y protocolo idempotente.

### 10.4 Multi-tenancy por `id_prestador`

**Decisión:** cada operario entra a SU prestador. Todas las tablas tienen FK `id_prestador`.

**Rationale:** permite que un mismo deployment sirva a múltiples prestadores sin filtrar datos.

**Tradeoff:** todas las queries deben incluir `WHERE id_prestador = ?` (es una convención disciplinada, no forzada por DB).

### 10.5 Tests colocados, no centralizados

**Decisión:** cada módulo tiene su `__tests__/` adyacente, no hay un `__tests__/` raíz centralizado.

**Rationale:** facilita encontrar los tests junto al código. Reduce la fricción de agregar tests.

**Tradeoff:** requiere discipline para no duplicar setup. La skill `docs-codebase` lo cataloga como "un módulo, un test set".

### 10.6 Strict TDD mode

**Decisión:** cada test rojo se commitea antes del feature. Cada RED commit es atómico.

**Rationale:** historial de git cuenta la historia del desarrollo. El reviewer puede ver exactamente qué se probó.

**Tradeoff:** más commits por feature (típicamente 2x: RED + GREEN). El ruido se mitiga con squash al mergear.

### 10.7 Conventional commits en inglés

**Decisión:** mensajes de commit en inglés, formato conventional commits, sin `Co-Authored-By`, sin emojis.

**Rationale:** permite generar changelogs automáticamente y mantener historial buscable.

**Tradeoff:** requiere discipline. El subject ≤ 50 caracteres fuerza a ser conciso.

### 10.8 Branches: `main` + `desarrollo` + `merge-desarrollo`

**Decisión:** `main` consolidada, `desarrollo` integración continua, `merge-desarrollo` limpieza.

**Rationale:** evita PR spam. Los cambios se acumulan en `desarrollo` y se mergean a `main` cuando están estables.

**Tradeoff:** `merge-desarrollo` queda como branch de limpieza. Se debe cerrar una vez mergeada (acción pendiente al cierre de esta entrega).
