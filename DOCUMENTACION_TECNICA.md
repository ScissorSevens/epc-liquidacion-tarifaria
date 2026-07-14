# Documentación Técnica
## Sistema de Liquidación Tarifaria EPC

**Versión:** 1.0  
**Fecha:** 10 de mayo de 2026  
**Autor:** Felipe Bernal Pachón  
**Cliente:** Empresas Públicas de Cundinamarca (EPC)  
**Universidad:** Universidad de Cundinamarca

---

## Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Componente: Dominio Puro (TypeScript)](#3-componente-dominio-puro-typescript)
4. [Componente: Aplicación Móvil](#4-componente-aplicación-móvil)
5. [Componente: Backend (API REST)](#5-componente-backend-api-rest)
6. [Componente: Dashboard Web](#6-componente-dashboard-web)
7. [Motor Tarifario CRA](#7-motor-tarifario-cra)
8. [Protocolo de Sincronización Offline](#8-protocolo-de-sincronización-offline)
9. [Modelo de Datos](#9-modelo-de-datos)
10. [Configuración y Despliegue](#10-configuración-y-despliegue)
11. [Pruebas](#11-pruebas)
12. [Limitaciones conocidas del MVP](#12-limitaciones-conocidas-del-mvp)
13. [Autenticación local multi-tenant](#13-autenticación-local-multi-tenant)

---

## 1. Visión General

El **Sistema de Liquidación Tarifaria EPC** es una solución full-stack diseñada para prestadores rurales de acueducto en Colombia. Automatiza la captura de lecturas de medidores en campo (offline) y el cálculo de liquidaciones tarifarias según la normativa CRA (Resolución 688/2014).

### Stack tecnológico

| Capa | Tecnología |
|---|---|
| Dominio puro | TypeScript 5, Jest |
| Aplicación móvil | React Native + Expo, expo-sqlite, TypeScript |
| Backend | .NET 8, ASP.NET Core Minimal API, Entity Framework Core 8 |
| Base de datos servidor | PostgreSQL 16 |
| Base de datos local | SQLite (expo-sqlite) |
| Dashboard web | HTML5 estático, Vanilla JS, bcrypt.js CDN |
| ORM | EF Core + Npgsql, snake_case naming convention |
| Logging | Serilog (CompactJsonFormatter) |
| Validación | FluentValidation |

---

## 2. Arquitectura del Sistema

### Diagrama de componentes

```
┌─────────────────────────────────────────────────────────────────┐
│                     Dispositivo móvil                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Aplicación Expo / React Native              │   │
│  │                                                         │   │
│  │  ┌──────────────┐    ┌──────────────┐                  │   │
│  │  │  Pantallas   │    │  Navegación  │                  │   │
│  │  │  (UI)        │    │  (Tab + Stack│                  │   │
│  │  └──────┬───────┘    └──────────────┘                  │   │
│  │         │ usa                                           │   │
│  │  ┌──────▼───────────────────────────────────────┐      │   │
│  │  │        Dominio Puro (TypeScript compartido)   │      │   │
│  │  │  motor-tarifario │ suscriptores │ lecturas    │      │   │
│  │  │  operarios │ medidores │ sincronizacion        │      │   │
│  │  └──────────────────────┬───────────────────────┘      │   │
│  │                         │ usa ports                     │   │
│  │  ┌──────────────────────▼───────────────────────┐      │   │
│  │  │         expo-sqlite (adaptadores)             │      │   │
│  │  │  suscriptor-repo │ lectura-repo │ cola-repo   │      │   │
│  │  └──────────────────────────────────────────────┘      │   │
│  │                     SQLite local                        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS (manual, cuando hay conexión)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Servidor                                     │
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

### Principio arquitectónico central

El sistema aplica **separación de capas estricta**:

1. **Dominio puro**: lógica de negocio en TypeScript puro, sin dependencias de framework, plataforma ni base de datos. Compartido entre mobile y (en el futuro) otros clientes.
2. **Puertos (interfaces)**: contratos que el dominio expone para acceso a datos.
3. **Adaptadores**: implementaciones concretas de los puertos para cada plataforma (expo-sqlite para mobile, EF Core para el servidor).
4. **UI (Pantallas)**: únicamente presentación; no contiene lógica de negocio.

---

## 3. Componente: Dominio Puro (TypeScript)

**Ubicación:** `sistema/src/`

Este módulo contiene la lógica de negocio central del sistema. Es agnóstico de plataforma: puede ejecutarse en React Native, Node.js o un navegador web.

### Estructura de módulos

```
sistema/src/
├── motor-tarifario/          # Cálculo de liquidación CRA
│   ├── motor-tarifario.ts    # calcularLiquidacion(), calcularBatch()
│   ├── types.ts              # EntradaCalculo, ResultadoCalculo, Estrato
│   └── __tests__/
├── suscriptores/             # Dominio de suscriptores
├── lecturas/                 # Dominio de lecturas
├── medidores/                # Dominio de medidores
├── operarios/                # Dominio de operarios
├── periodos/                 # Dominio de períodos
├── sincronizacion/           # Motor de cola de sincronización
├── persistencia/             # Interfaces de repositorio (puertos)
│   └── sqlite/               # Implementación better-sqlite3 (Node.js/tests)
│       └── migrations/       # Scripts DDL de migración
├── shared/                   # Tipos y puertos compartidos
│   ├── ports/                # Interfaces (IOperarioRepository, etc.)
│   └── adapters/             # Utilidades de adaptación
├── calculo/                  # Orquestador del cálculo completo
├── captura-lecturas/         # Caso de uso: capturar lectura
├── factura/                  # Modelo de factura (dominio)
├── auditoria/                # Trazabilidad de operaciones
├── importacion/              # Importación de suscriptores desde CSV
└── cliente-http/             # Adaptador HTTP para sincronización
```

### Dependencias clave

- **TypeScript 5**: tipado estático total
- **Jest + ts-jest**: tests unitarios del motor tarifario y dominio
- **better-sqlite3**: implementación SQLite para tests de integración (Node.js)
- **uuid**: generación de identificadores únicos cliente

---

## 4. Componente: Aplicación Móvil

**Ubicación:** `sistema/mobile/`

### Stack

- **React Native** con **Expo SDK**
- **TypeScript** estricto
- **expo-sqlite**: base de datos SQLite embebida en el dispositivo
- **@react-navigation/bottom-tabs + stacks**: navegación entre pantallas
- **@expo/vector-icons / MaterialIcons**: íconos (compatible con Expo Go)

> **Restricción importante:** `react-native-vector-icons` NO es compatible con Expo Go. Se usa exclusivamente `@expo/vector-icons`.

### Estructura de navegación

```
AppNavigator (Bottom Tabs)
├── Tab: INICIO → InicioStack
│   └── RutaDeHoy          ← pantalla inicial
│       └── (navega a) LecturasStack/DetalleSuscriptor
├── Tab: LECTURAS → LecturasStack
│   ├── ListaSuscriptores
│   ├── DetalleSuscriptor
│   ├── CapturarLectura
│   │   └── CapturarFoto
│   ├── ResultadoCalculo
│   ├── AltaSuscriptor
│   └── ImportarCsv
├── Tab: SYNC → SyncStack
│   └── Sincronizacion
└── Tab: CONFIG → ConfigStack
    └── Configuracion
```

### Pantallas

| Pantalla | Archivo | Descripción |
|---|---|---|
| RutaDeHoy | `pantallas/RutaDeHoy.tsx` | Lista de suscriptores + progreso del día |
| ListaSuscriptores | `pantallas/ListaSuscriptores.tsx` | Búsqueda y listado |
| DetalleSuscriptor | `pantallas/DetalleSuscriptor.tsx` | Datos del suscriptor y medidor |
| CapturarLectura | `pantallas/CapturarLectura.tsx` | Formulario de lectura |
| CapturarFoto | `pantallas/CapturarFoto.tsx` | Toma de foto de evidencia |
| ResultadoCalculo | `pantallas/ResultadoCalculo.tsx` | Desglose de la liquidación |
| AltaSuscriptor | `pantallas/AltaSuscriptor.tsx` | Registro de nuevo suscriptor |
| ImportarCsv | `pantallas/ImportarCsv.tsx` | Importación masiva desde CSV |
| Sincronizacion | `pantallas/Sincronizacion.tsx` | Panel de sync manual |
| Configuracion | `pantallas/Configuracion.tsx` | URL del backend |

### Persistencia local (expo-sqlite)

Los repositorios en `mobile/src/persistencia/expo-sqlite/` implementan los puertos del dominio puro:

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

`mobile/src/composition/bootstrap.ts` y `get-bootstrap.ts` realizan la inyección de dependencias: instancian repositorios, el procesador de cola y el cliente HTTP, y los conectan al dominio puro.

```typescript
// Acceso desde cualquier pantalla:
const bootstrap = await getBootstrap();
const suscriptores = await bootstrap.suscriptorRepo.listar();
```

---

## 5. Componente: Backend (API REST)

**Ubicación:** `sistema/backend/src/MediApp.Api/`

### Stack

- **.NET 8** + **ASP.NET Core Minimal API**
- **Entity Framework Core 8** + **Npgsql** (PostgreSQL)
- **EFCore.NamingConventions**: convención `snake_case` en todas las columnas y tablas
- **FluentValidation**: validación de payloads por feature
- **Serilog** (CompactJsonFormatter): logging estructurado JSON
- **Swagger / OpenAPI**: disponible solo en entorno `Development`

### Endpoints disponibles

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

El backend **nunca hashea contraseñas**. El hash bcrypt (cost ≥ 10) se aplica en el dashboard (cliente JavaScript) **antes** del POST. El campo `password_hash` nunca se retorna en ninguna respuesta de la API.

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

## 6. Componente: Dashboard Web

**Ubicación:** `sistema/backend/src/MediApp.Api/wwwroot/index.html`

El dashboard es una **SPA estática** servida directamente por el backend ASP.NET Core (`UseStaticFiles` + `MapFallbackToFile`). No requiere npm, webpack ni ningún proceso de build.

### Características técnicas

- HTML5 + CSS3 + Vanilla JavaScript
- **bcrypt.js** cargado desde CDN: hash de contraseñas en el cliente (cost = 10) antes de enviar al backend
- Fetch API para comunicación con el backend REST
- Sin frameworks frontend (zero-dependency)

### Secciones del dashboard

1. **Operarios**: CRUD completo + vinculación de dispositivos
2. **Suscriptores**: consulta de todos los suscriptores sincronizados
3. **Lecturas**: consulta con datos del medidor y suscriptor
4. **Liquidaciones**: consulta de liquidaciones calculadas

---

## 7. Motor Tarifario CRA

**Ubicación:** `sistema/src/motor-tarifario/motor-tarifario.ts`

El motor implementa la metodología tarifaria de la **CRA Resolución 688/2014** para acueducto.

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
| `parametros.cargoFijo` | `number` | CF mensual en pesos (puede ser 0) |
| `parametros.precioM3` | `number` | Precio del m³ en bloque básico |
| `parametros.precioM3Excedente` | `number` | Precio del m³ en bloque excedente |
| `parametros.consumoBasico` | `number` | Límite del bloque básico (default: 20 m³) |

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

### Fórmula de cálculo

```
consumo = lecturaActual - lecturaAnterior
consumoBasico = min(consumo, limiteBasico)
consumoExcedente = max(consumo - limiteBasico, 0)

cargoConsumo = round(consumoBasico × precioM3)
cargoExcedente = round(consumoExcedente × precioM3Excedente)
cargoFijo = round(cargoFijoRaw)

// Factor de estrato (CRA Res. 688/2014):
// Estrato 1: -70% | 2: -40% | 3: -15% | 4: 0% | 5: +50% | 6: +60%

// Subsidio (estratos 1-3): aplica sobre CF + cargoConsumo básico
subsidio = round(|factor| × (cargoFijo + cargoConsumo))   si factor < 0

// Contribución (estratos 5-6): aplica sobre CF + consumo total
contribucion = round(factor × (cargoFijo + cargoConsumo + cargoExcedente))  si factor > 0

total = cargoFijo + cargoConsumo + cargoExcedente - subsidio + contribucion
```

### Validaciones del motor

- Lecturas no pueden ser negativas
- Lectura actual ≥ lectura anterior
- Cargo fijo ≥ 0 (0 es válido por Decreto 0776/2025 mínimo vital)
- Precio m³ y precio m³ excedente > 0
- Límite consumo básico > 0
- Estrato entre 1 y 6 (si se provee)
- Mes entre 1 y 12, año ≥ 2000 (si se provee período)

### Parámetros tarifarios demo (mobile)

Durante el MVP, los parámetros tarifarios están hardcodeados en:
`mobile/src/composition/parametros-tarifarios-demo.ts`

El administrador de EPC es responsable de configurar los valores reales (CF y CC) de acuerdo a la resolución tarifaria vigente del prestador. Estos valores deben incorporar previamente los factores ISE, fa, fct y pérdidas (ASP) según la metodología CRA.

---

## 8. Protocolo de Sincronización Offline

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

## 9. Modelo de Datos

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

Para el modelo físico completo, campos y restricciones, ver:
`modelo de datos/MODELO_FISICO.md` (v1.1, 10 mayo 2026)

### Base de datos SQLite (dispositivo móvil)

Espejo del modelo PostgreSQL, adaptado para offline-first. Las columnas de fechas se almacenan como strings ISO 8601.

---

## 10. Configuración y Despliegue

### Variables de configuración del backend

Archivo: `backend/src/MediApp.Api/appsettings.json`

```json
{
  "ConnectionStrings": {
    "Default": "Host=localhost;Database=mediapp;Username=...;Password=..."
  }
}
```

### Puerto por defecto

El backend escucha en el puerto **5180** en entorno de desarrollo:

```
http://localhost:5180
```

Configurado en `Properties/launchSettings.json`.

### Aplicar migraciones

```bash
cd sistema/backend/src/MediApp.Api
dotnet ef database update
```

### Ejecutar el backend

```bash
dotnet run --project sistema/backend/src/MediApp.Api
```

### Ejecutar la aplicación móvil

```bash
cd sistema/mobile
npx expo start
```

### Ejecutar tests del dominio

```bash
cd sistema
npm test                  # Jest — tests del dominio TypeScript
```

```bash
cd sistema/backend
dotnet test               # xUnit — tests del backend .NET
```

---

## 11. Pruebas

### Tests TypeScript (Jest)

**Motor tarifario:** `sistema/src/motor-tarifario/__tests__/motor-tarifario.test.ts`

Cubre:
- Consumo cero (sin lectura)
- Consumo dentro del bloque básico
- Consumo mixto (básico + excedente)
- Subsidios por estrato 1, 2, 3
- Contribuciones por estrato 5, 6
- Estrato 4 (sin ajuste)
- Cargo fijo = 0 (mínimo vital)
- Validaciones de entrada (lecturas negativas, lectura actual < anterior, etc.)
- Procesamiento batch con errores aislados

**Repositorio de operarios (expo-sqlite):** `mobile/src/persistencia/expo-sqlite/__tests__/operario-repository-expo-sqlite.test.ts`

### Tests .NET (xUnit)

**Feature Operarios:** `sistema/backend/tests/` — 38 tests (T-01 a T-22)

Cubre el ciclo CRUD completo de operarios:
- Creación con validaciones
- Conflictos por cédula duplicada y email duplicado
- Listado con filtro `soloActivos`
- Actualización parcial
- Vinculación de dispositivo (idempotencia, conflictos)
- Casos de error (not found, validación)

> **Nota técnica:** Los tests xUnit usan `[Collection]` / `[CollectionDefinition]` para evitar el error _"Serilog logger already frozen"_ que ocurría al ejecutarlos en paralelo.

---

## 12. Limitaciones conocidas del MVP

Las siguientes limitaciones son conocidas y aceptadas para la versión inicial del sistema:

| # | Limitación | Descripción | Normativa afectada |
|---|---|---|---|
| L-01 | **Motor de 2 bloques** | El motor tarifario implementa bloques básico y excedente. El bloque suntuario (consumo >20 m³ con tarifa diferenciada adicional) no está implementado. | CRA Res. 688/2014 — 3 bloques |
| L-02 | **CF y CC precalculados** | El motor recibe el cargo fijo (CF) y el precio por m³ (CC) ya calculados por el administrador. No calcula estos valores desde los costos reales del prestador (estructura bottom-up de la CRA). | CRA Res. 688/2014 — fórmulas de CF y CC |
| L-03 | **Parámetros tarifarios hardcodeados** | En la versión MVP, los parámetros tarifarios están hardcodeados en el código. No existe interfaz de administración para cambiarlos sin modificar el código. | — |
| L-04 | **Cédula del operario: 12 chars** | La especificación define 15 caracteres para `numero_cedula`; el código implementa 12. | — |
| L-05 | **PERIODO, PARAMETROS_TARIFA, AUDITORIA** | Estas entidades existen en el dominio puro TypeScript pero **no tienen tabla en el backend** PostgreSQL. Sus datos se gestionan solo en el cliente. | — |
| L-06 | **Facturación física** | El sistema calcula y almacena liquidaciones pero no genera ni distribuye facturas en papel o digital. | — |
| L-07 | **ISE, fa, fct, pérdidas** | Estos factores de la metodología CRA son incorporados por el administrador antes de ingresar CF y CC al sistema. No se calculan automáticamente. | CRA Res. 688/2014 |

---

## 13. Autenticación local multi-tenant

El SDD `setup-inicial-multi-tenant-auth` implementa el flujo actual de autenticación completamente en el dispositivo: setup inicial, login contra SQLite, sesión persistida durante 24 horas, selección del prestador del operario y logout. El backend real de autenticación queda para la Fase 6.

### 13.1 Schema SQLite de `prestador`

La tabla canónica `prestador` se crea en la migración 009. La migración 016 agrega los datos del representante legal requeridos por el setup.

| Columna | Tipo / restricciones |
|---|---|
| `id_prestador` | `INTEGER PRIMARY KEY AUTOINCREMENT`; `0` está reservado para `EPC-LEGACY` |
| `codigo` | `TEXT NOT NULL UNIQUE` |
| `nombre` | `TEXT NOT NULL` |
| `nit` | `TEXT NOT NULL` |
| `representante_legal` | `TEXT NOT NULL DEFAULT ''` — agregada por la migración 016 |
| `representante_legal_cedula` | `TEXT NOT NULL DEFAULT ''` — agregada por la migración 016 |
| `municipio` | `TEXT NOT NULL` |
| `departamento` | `TEXT NOT NULL` |
| `segmento` | `INTEGER NOT NULL CHECK (segmento IN (1, 2))` |
| `num_suscriptores_urbanos` | `INTEGER NOT NULL DEFAULT 0 CHECK (valor >= 0)` |
| `num_suscriptores_rurales` | `INTEGER NOT NULL DEFAULT 0 CHECK (valor >= 0)` |
| `contacto` | `TEXT NULL` |
| `estado` | `TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'suspendido'))` |
| `created_at`, `updated_at` | Fechas ISO 8601 almacenadas como `TEXT` |

Los índices `idx_prestador_municipio` e `idx_prestador_estado` soportan los filtros administrativos.

### 13.2 Schema SQLite de `operario`

La tabla canónica `operario` se crea en la migración 015. La migración 016 agrega la relación multi-tenant y reemplaza la unicidad global del dispositivo por una restricción compuesta.

| Columna | Tipo / restricciones |
|---|---|
| `id_operario` | `INTEGER PRIMARY KEY AUTOINCREMENT` |
| `numero_cedula` | `TEXT NOT NULL UNIQUE` |
| `nombre` | `TEXT NOT NULL` |
| `email` | `TEXT NOT NULL DEFAULT ''` |
| `password_hash` | `TEXT NOT NULL DEFAULT ''` |
| `rol` | `TEXT NOT NULL DEFAULT 'operario' CHECK (rol IN ('operario', 'supervisor', 'admin'))` |
| `estado` | `TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo'))` |
| `dispositivo_id` | `TEXT NULL` |
| `id_prestador` | `INTEGER NOT NULL DEFAULT 0`, FK a `prestador(id_prestador)` con `ON DELETE RESTRICT`; agregada por la migración 016 |
| `created_at` | Fecha ISO 8601 almacenada como `TEXT` |

Índices relevantes:

- `idx_operario_dispositivo_prestador_unique`: UNIQUE parcial sobre (`dispositivo_id`, `id_prestador`) cuando `dispositivo_id IS NOT NULL`.
- `idx_operario_id_prestador`: acelera consultas filtradas por tenant.

> **Nota de implementación:** el adapter mobile usado actualmente por `loginLocal` conserva por compatibilidad histórica una tabla de cache llamada `operarios` (plural). Esa tabla contiene `id_prestador` y `password_hash`; la migración 017 agrega `password_hash` a instalaciones previas al PUNTO A. Las migraciones canónicas 015/016 mantienen la tabla `operario` (singular).

### 13.3 Persistencia de sesión

La sesión se guarda en AsyncStorage bajo la clave `@sistema_epc:sesion` con esta forma:

```typescript
interface Sesion {
  token: string;
  cedula: string;
  nombre?: string;
  idPrestador: number;
  expiresAt: number; // timestamp absoluto en milisegundos
}
```

Flujo de los helpers:

- `guardarSesion(sesion)`: serializa el objeto completo a JSON y lo escribe en AsyncStorage. Un login posterior reemplaza cualquier sesión vencida.
- `cargarSesion()`: consulta primero `estadoSesionPersistida()`; solo vuelve a leer y devolver la sesión cuando el estado es `valida`. Para los demás estados devuelve `null`.
- `limpiarSesion()`: elimina la clave de AsyncStorage. El logout también limpia el workspace para remover el prestador activo.

`estadoSesionPersistida()` distingue cuatro estados:

| Estado | Condición | Acción |
|---|---|---|
| `no_existe` | La clave no está en AsyncStorage | Devuelve el estado sin limpiar nada; AuthGate muestra Login silencioso si ya existe un prestador |
| `vencida` | El shape es válido, pero `expiresAt <= Date.now()` | Conserva la entrada para que AuthGate muestre el banner amarillo de sesión vencida |
| `invalida` | JSON corrupto o faltan `token`, `cedula`, `idPrestador > 0` o `expiresAt` | Limpia la entrada defensivamente y muestra Login sin banner |
| `valida` | Shape completo y `expiresAt > Date.now()` | `cargarSesion()` devuelve la sesión y AuthGate sincroniza el workspace |

### 13.4 `bootstrapCompleto`

`bootstrapCompleto()` crea el tenant local en este orden:

1. Prestador con código correlativo.
2. Acuerdo municipal vigente con valores iniciales.
3. Parámetros tarifarios vinculados al acuerdo.
4. Primer operario vinculado al `id_prestador`, con `password_hash` SHA-256.
5. Sesión local con token `fake-token-{timestamp}` y vencimiento a 24 horas.

Los repositorios no exponen una transacción SQLite común, por lo que la atomicidad se implementa mediante rollback manual:

- Si falla el acuerdo, elimina el prestador.
- Si fallan los parámetros, elimina el acuerdo y el prestador.
- Si falla el operario, elimina los parámetros, el acuerdo y el prestador.

Así, un error durante el setup permite reintentar el wizard sin dejar un tenant parcialmente creado.

### 13.5 `loginLocal`

`loginLocal()` es una función sin efectos secundarios que recibe el repositorio de operarios y el hasher por inyección de dependencias. El flujo es:

1. Normaliza la cédula y busca el operario en SQLite.
2. Si no existe, lanza `OPERARIO_NO_ENCONTRADO`.
3. Calcula SHA-256 sobre la contraseña ingresada y la compara con `password_hash`.
4. Si no coincide, lanza `PASSWORD_INCORRECTA`.
5. Si coincide, crea una sesión con el `idPrestador` real del operario, token `fake-token-{timestamp}` y `expiresAt = Date.now() + 24h`.

`Login.tsx` se encarga de persistir el resultado mediante `guardarSesion()`, sincronizar `useWorkspace.setSesionCompleta()` y traducir los errores técnicos a mensajes para el usuario. En la Fase 6 este flujo local se reemplazará por autenticación contra el backend y token GUID.
