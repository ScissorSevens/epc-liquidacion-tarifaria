# MediApp — App móvil

Proyecto Expo + TypeScript de la app de captura de lecturas en campo.
Reusa el dominio TS desde `../src` vía path mapping `@dominio/*`
(Opción 2 monorepo "lazy", sin workspaces npm/yarn).

## Arrancar dev server

```bash
cd mobile
npm install         # primera vez (~700 paquetes, ~45 s)
npx expo start      # dev server + QR para Expo Go
```

Escaneá el QR con **Expo Go** en Android (mismo WiFi que el PC). Si la
red lo bloquea, usá `npx expo start --tunnel` (más lento pero atraviesa
NAT).

## Stack

- React Native vía **Expo SDK 54** (managed workflow)
- React 19, RN 0.81, TypeScript 5.9 strict
- Metro observa `../src` y resuelve `@dominio/*`
- Persistencia local: **expo-sqlite** (~16.0.10)

## Persistencia local

Toda la persistencia offline-first vive en una única base SQLite en
disco del dispositivo:

- **Tecnología**: `expo-sqlite`
- **DB name**: `mediapp.db` (constante `NOMBRE_DB_MOVIL` en
  `src/composition/bootstrap.ts`).
- **Migraciones**: idempotentes, registradas en
  `__migraciones_aplicadas`. Definidas en
  `src/persistencia/expo-sqlite/migraciones.ts` espejando los `.sql` de
  `../src/persistencia/sqlite/migrations/`.
- **Adapters async**:
  - `factura-repository-expo-sqlite.ts`
  - `lectura-repository-expo-sqlite.ts`
  - `cola-repository-expo-sqlite.ts`

  Espejan a los adapters Node de `src/factura/` y
  `src/persistencia/sqlite/`. Misma SQL, misma semántica, todos los
  métodos `Promise<>` (la API de expo-sqlite es asíncrona).

### Cablear los repos

```typescript
import { bootstrapApp } from './src/composition/bootstrap';

const { db, facturaRepo, lecturaRepo, colaRepo, smoke } =
  await bootstrapApp();
```

### Inspeccionar la DB en runtime

1. `npx expo start` y abrí la app en Expo Go.
2. Tocá **"Probar Persistencia SQLite"** en `HolaMediApp`. El demo
   inserta una lectura, la lee de vuelta, encola un mensaje sync y
   muestra todo en un `Alert`.
3. Para inspección más profunda, los logs de las queries SQL aparecen
   en la terminal de `expo start` (Metro forwarding).
4. En Android emulator también podés extraer la DB de
   `/data/data/host.exp.exponent/databases/mediapp.db` con `adb pull`.

### Por qué adapters paralelos (no refactor)

`better-sqlite3` (los adapters Node) tiene bindings nativos C++ que NO
linkean en RN. La decisión arquitectónica fue duplicar el adapter en
async sobre `expo-sqlite` antes que refactorizar todos los Node
existentes. Tradeoff aceptado:

- ✅ Cero impacto en los 491 tests del root (siguen verde con
  better-sqlite3).
- ✅ Validación contractual de la SQL ya está cubierta por los Node.
- ⚠️ Si la SQL del root cambia, hay que reflejar el cambio en los
  espejos de `mobile/src/persistencia/expo-sqlite/` a mano.

## Tests

Los tests del wiring móvil corren con el **jest del root**:

```bash
cd ..
npm test                                      # 491 tests, incluye 2 del wiring móvil
npx jest mobile/__tests__/bootstrap.test.ts   # solo el wiring
```

El bootstrap REAL (`bootstrap.ts`) usa expo-sqlite y solo se invoca en
runtime móvil (Expo Go). Para tests Node-ables tenemos
`smoke-dominio.ts` que NO importa expo-sqlite y valida el path mapping
+ el motor tarifario puro.

## Sincronización con backend

El bootstrap cablea un `clienteHttp` (`ClienteHTTPSincronizacion` del
dominio) y un `procesadorCola()` que invoca la cola SQLite local
contra el backend `.NET`. La pantalla **Sincronización** (accesible
desde Home) ofrece tres acciones manuales:

- **PROBAR CONEXIÓN** → `GET ${baseUrl}/health`.
- **SINCRONIZAR AHORA** → ejecuta `procesarCola()` y muestra contadores
  exitosos / conflictos / fallidos / pendientes.
- **VER COLA** → lista items por estado.

### Levantar el backend

```powershell
# Opcion A: docker compose (recomendado)
docker compose -f ..\backend\docker-compose.yml up -d

# Opcion B: dotnet run directo
dotnet run --project ..\backend\src\MediApp.Api
```

Healthcheck:

```powershell
Invoke-RestMethod http://localhost:5080/health
```

Seedear datos demo (solo en Development):

```powershell
Invoke-RestMethod -Method Post http://localhost:5080/api/v1/_dev/seed
```

### Apuntar la app al backend correcto

Editar `mobile/app.json` -> `expo.extra`:

```json
"extra": {
  "apiBaseUrl": "http://10.0.2.2:5080",
  "apiBaseUrlLan": "http://172.100.7.217:5080"
}
```

Hoy `obtenerApiBaseUrl()` devuelve **siempre** `apiBaseUrlLan`. Si vas
a usar emulador Android local sin red LAN, editá la función para que
devuelva `apiBaseUrl` en su lugar (`mobile/src/config/api.ts`).

Para descubrir la IP LAN del host Windows:

```powershell
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.InterfaceAlias -match 'Ethernet|Wi-Fi' } |
  Select-Object IPAddress, InterfaceAlias
```

Reemplazá `172.100.7.217` por la IP que te devuelva ese comando y
reiniciá `npx expo start`.

## Deuda técnica conocida

### Adapter HTTP de sincronización

`mobile/src/sincronizacion/adapter-cliente-http.ts` envuelve el
wiring del mobile para traducir `ItemCola` (dominio) → `SyncRequest<T>`
(backend). Existe porque la **decisión D33** congeló `src/` pre-entrega
y el cliente HTTP del dominio tiene tres desalineaciones con el backend
.NET ya desplegado:

1. Rutas sin `/v1` (dominio: `/api/lecturas`, backend: `/api/v1/lecturas`).
2. `ItemCola` no expone `idCliente` ni serializa `forzarSobrescribir`,
   ambos exigidos por el `SyncRequest<T>`.
3. `ItemCola` carga campos extra (`estado`, `ultimoError`, `creadoEn`)
   que el backend ignora pero ensucian el body.

**Cuándo se borra**: cuando se libere el congelamiento del dominio
post-entrega. El mapeo se mueve al `ClienteHTTPSincronizacion` real y
este adapter desaparece.

### Tipos no sincronizados en el sprint

El operario solo carga **lecturas** y **liquidaciones** en campo.
Los siguientes `TipoItem` están definidos en el dominio pero el backend
NO expone endpoints para ellos en el sprint actual:

- `EVIDENCIA` — fotos de medidor (planificado para sprint posterior).
- `EVENTO_AUDITORIA` — log de actividad del operario (sin endpoint).
- `FACTURA` — emisión, va por otro flujo (no se sincroniza desde celu).

Si por alguna razón aparece un item de estos tipos en la cola, el
adapter responde `ok:false` con un error explícito (`tipo X no
soportado en sprint actual`) y el procesador lo termina marcando como
`FALLIDO` tras `MAX_INTENTOS` — sin loop, sin conflicto fantasma.

### `dispositivoId` hardcoded

El adapter construye `idCliente` como `${dispositivoId}:${item.id}`,
con `dispositivoId = 'mobile'` como constante hardcoded. Funciona para
el sprint con un solo operario / un solo dispositivo, pero **rompe**
si dos celulares cargan items con el mismo `item.id` (no debería
pasar — UUID v4 colisiona con probabilidad despreciable, pero dependés
del PRNG del celu).

Sofisticar post-entrega con:

- `expo-application.getAndroidId()` — ID estable por instalación.
- O un UUID generado al primer arranque y persistido en SQLite (tabla
  `dispositivo`).

## Estructura

```
mobile/
├── App.tsx
├── app.json                   # plugin expo-sqlite registrado
├── metro.config.js            # watchFolders → workspaceRoot
├── tsconfig.json              # paths @dominio/* → ../src/*
├── __tests__/
│   └── bootstrap.test.ts      # wiring smoke (corre con jest del root)
└── src/
    ├── composition/
    │   ├── bootstrap.ts       # async, abre DB + migra + cablea repos
    │   └── smoke-dominio.ts   # smoke puro (Node-importable)
    ├── pantallas/
    │   └── HolaMediApp.tsx    # demo end-to-end persistencia
    └── persistencia/
        └── expo-sqlite/
            ├── migraciones.ts
            ├── factura-repository-expo-sqlite.ts
            ├── lectura-repository-expo-sqlite.ts
            └── cola-repository-expo-sqlite.ts
```
