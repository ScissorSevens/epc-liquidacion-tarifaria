# epc-liquidacion-tarifaria

Sistema full-stack para prestadores rurales de agua potable vinculados a **Empresas Públicas de Cundinamarca (EPC)**. Automatiza la captura de lecturas de medidores en campo (modo offline) y el cálculo de liquidaciones tarifarias según normativa CRA vigente para prestadores rurales con menos de 5.000 suscriptores.

> **Estado (agosto 2026):** cumplimiento Res CRA 825/2017 + Res CRA 907/2019 + Res CRA 750/2016. 1952 tests verde, 0 CRITICAL en code review.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Lenguaje núcleo | TypeScript 5/6 strict |
| Workspaces | npm workspaces (monorepo) |
| Dominio puro (motor tarifario, cálculos, repos) | TypeScript + Jest 30 + ts-jest 29 |
| Aplicación móvil | React Native 0.81 + Expo SDK 54 + React 19.1 + expo-router 6 + expo-sqlite 16 |
| Estado móvil | Zustand 5 |
| UI móvil | react-native-paper 5 |
| Hardware móvil | expo-camera, react-native-ble-plx (Bluetooth impresión) |
| Backend | .NET 8, ASP.NET Core Minimal API, EF Core 8 |
| Base de datos servidor | PostgreSQL 16 |
| Base de datos local mobile | SQLite (expo-sqlite) |
| Base de datos local backend | better-sqlite3 (Node.js) |
| Dashboard | HTML5 + Vanilla JS + bcrypt.js (cliente) |
| Especificación | OpenSpec + Engram (memoria persistente cross-session) |
| Testing mobile | jest-expo + @testing-library/react-native |

---

## Estructura del repositorio

```
sistema/
├── src/                                # Dominio puro TypeScript (raíz, multi-tenant)
│   ├── motor-tarifario/                # Cálculo CRA: CF, CC, subsidios, validaciones
│   ├── parametros-tarifa/              # Dominio ParametrosTarifa
│   ├── acuerdo-municipal/              # Dominio AcuerdoMunicipal + estado ciclo de vida
│   ├── suscriptores/                   # Dominio suscriptores + verificación de estrato
│   ├── medidores/                      # Dominio medidores
│   ├── lecturas/                       # Dominio lecturas
│   ├── operarios/                      # Dominio operarios
│   ├── prestadores/                    # Dominio prestadores (multi-tenant)
│   ├── factura/                        # Dominio factura + snapshot validacion_ambito
│   ├── importacion/                    # Importación masiva desde CSV
│   ├── sincronizacion/                 # Cola de sincronización offline
│   ├── captura-lecturas/               # Captura de lecturas en campo
│   ├── calculo/                        # Cálculos auxiliares
│   ├── auditoria/                      # Auditoría regulatoria
│   ├── persistencia/                   # Adaptadores SQLite (integration tests)
│   ├── cliente-http/                   # HTTP client para backend .NET
│   ├── categorias-uso/                 # Categorías (residencial, comercial, etc.)
│   ├── periodos/                       # Dominio de períodos de facturación
│   ├── componentes/                    # Componentes auxiliares
│   └── shared/                         # Utilidades compartidas
├── mobile/                             # App móvil (Expo + React Native)
│   ├── dominio/                        # Re-exports + tipos específicos de UI
│   ├── src/
│   │   ├── pantallas/                  # Pantallas (ParametrosTarifa, RutaDeHoy, etc.)
│   │   ├── persistencia/               # Repositorios expo-sqlite
│   │   ├── composition/                # Bootstrap + inyección de dependencias
│   │   ├── componentes/                # Componentes UI presentacionales
│   │   ├── hooks/                      # Hooks custom
│   │   ├── theme/                      # Tema y design tokens
│   │   ├── adapters/                   # Adapters (Bluetooth, impresión)
│   │   └── navegacion/                 # Navegación + auth gate
│   └── __tests__/                      # Tests colocados + integración
├── backend/                            # API REST (.NET 8) + Dashboard web
│   └── src/MediApp.Api/
│       ├── Features/                   # Operarios, Suscriptores, Medidores, Lecturas
│       ├── Persistence/                # EF Core + migraciones PostgreSQL
│       └── wwwroot/                    # Dashboard HTML estático
├── openspec/                           # (gitignored) OpenSpec artifacts
│   ├── config.yaml                     # Strict TDD mode + reglas
│   ├── specs/                          # Specs consolidadas
│   └── changes/                        # Changes activos + archive/
│       └── archive/                    # 20+ cambios archivados
├── .atl/                               # (gitignored) Skill registry del proyecto
├── docs/                               # (gitignored) Documentación adicional
├── DOCUMENTACION_TECNICA.md            # (gitignored) Doc técnica extendida
├── MANUAL_DE_USUARIO.md                # (gitignored) Manual para operarios/admin
└── README.md                           # Este archivo
```

---

## Pruebas automatizadas

| Suite | Runner | Estado |
|---|---|---|
| Dominio TypeScript (`src/`) | Jest + ts-jest 29 | 1952/1952 verde, 161 suites |
| Type check | `npx tsc --noEmit` | 0 errores |
| Backend .NET (`backend/`) | xUnit | ver `backend/README.md` |

```bash
# Suite completa (raíz del proyecto, workspaces)
cd sistema
npm test

# Solo mobile
cd sistema/mobile
npx jest

# Solo dominio (raíz)
cd sistema
npx jest --testPathPattern=src/

# Con cobertura
cd sistema
npm run test:coverage

# Type check mobile
cd sistema/mobile
npx tsc --noEmit

# Backend
cd sistema/backend
dotnet test
```

---

## Normativa aplicada

| Norma | Aplica a | Alcance en el sistema |
|---|---|---|
| **Res CRA 825/2017** | Prestadores rurales <5000 suscriptores | Base normativa: fórmula CF, CC, subsidios E1-E3, contribuciones E5-E6, CMOG mínimo |
| **Res CRA 907/2019** | Modifica arts. 9 y 10 de la 825 | Introduce CMAA (inversiones ambientales) + CMVIAA |
| **Res CRA 750/2016** | Consumo básico por altitud | Límite básico varía con altitud_msnm del prestador |
| **Ley 142/1994 art. 99.6** | Topes subsidios | E1 [-60%], E2 [-50%], E3 [-40%], E5 [+50%], E6 [+60%] |
| **Res CRA 881/2019** | Inversiones ambientales | Adiciona artículos sobre inversiones |

**No aplica** a este proyecto: Res CRA 1032/2026 (vigente desde 24/03/2026) porque es para prestadores >5000 suscriptores urbanos.

Documentación normativa completa en `Documentos/Normativa-CRA/Res-825-2017/markdown/`.

---

## Compliance CRA 825/2017 — estado (agosto 2026)

Resultado del gap analysis + 2 fases de implementación:

| Fase | Change | Gaps cerrados | Estado |
|---|---|---|---|
| 1 (julio 2026) | `param-tarifa-res-825-compliance-phase1` | CMA mínimo, IPC, año base 2016, campo `aps` | Archivado |
| 2 (agosto 2026) | `param-tarifa-res-825-compliance-phase2` | Fórmula CF corregida, CMAA, validarAmbito, validarCmogMinimo, Acuerdo.estado, estado_verificacion, 3 campos docs, @deprecated calcularCCUnitario | Archivado |

**Diferidos explícitamente** (cambios dedicados futuros):
- GAP-6: MetadataCalculo completo §11 (20+ campos) → `auditoria-mejorada-cra-825`
- GAP-10: Contrato de salida del agente IA §12 → `agente-validacion-cra-825`

---

## Comandos principales

### App móvil

```bash
# Levantar Expo Go (con cache limpia + sin chequeo de versión)
cd mobile
EXPO_NO_VERSION_CHECK=1 npx expo start --clear

# Escanear QR con Expo Go en Android (mismo WiFi que el servidor)
```

> **Por qué `--clear` + `EXPO_NO_VERSION_CHECK=1`:** evita caché stale y el warning de versión. Probado en este proyecto (ver engram: "no over-engineer start-dev.js").

### Backend

```bash
# Aplicar migraciones PostgreSQL
cd backend/src/MediApp.Api
dotnet ef database update

# Ejecutar servidor (puerto 5180, IP 192.168.40.48)
dotnet run --project backend/src/MediApp.Api
```

### Tests

```bash
# Suite completa con cobertura
cd sistema
npm run test:coverage

# Solo un archivo
cd mobile
npx jest --testPathPatterns=motor-tarifario
```

---

## Arquitectura offline-first

```
Dispositivo Android (sin internet)
  └── Captura lecturas + fotos + verificación de estrato
          └── SQLite local (expo-sqlite) + cola de sincronización
                  │
                  │  (cuando hay WiFi — acción manual del operario)
                  ▼
Servidor local (red LAN del prestador)
  └── MediApp.Api → PostgreSQL → Dashboard web
```

---

## Auth y multi-tenant

Implementado según SDD `setup-inicial-multi-tenant-auth` (archivado en `openspec/changes/archive/`):

- **Setup inicial**: wizard de 2 pasos en el primer inicio (configurar prestador + crear primer operario admin).
- **Login**: validación de cédula + password contra SQLite local. Password se hashea con SHA-256 del lado del cliente; el backend NO hashea (decisión arquitectónica: bcrypt se hace en cliente).
- **Multi-tenant**: cada operario entra a SU prestador usando el `idPrestador` asociado en SQLite, sin valores hardcodeados. Toda la liquidación lleva FK `id_prestador`.
- **Token**: sesión vence a las 24 horas. Banner amarillo al vencer pidiendo credenciales.
- **Cerrar sesión**: Mi Perfil → Gestión → Cerrar sesión.

> **Limitación actual:** token es `fake-token-{timestamp}`. Próxima fase: GUID generado por backend .NET con `expiresAt` validado contra PostgreSQL.

---

## SDD workflow (Spec-Driven Development)

Este proyecto usa un workflow estructurado para cambios sustanciales:

```
proposal → specs → design → tasks → apply → verify → archive
```

- **Proposal** (`openspec/changes/{nombre}/proposal.md`): intent + scope + enfoque.
- **Specs** (`openspec/changes/{nombre}/specs/`): requisitos con Given/When/Then + RFC 2119.
- **Design** (`openspec/changes/{nombre}/design.md`): decisiones B/B/B (Bueno/Barato/Breve) + tradeoffs.
- **Tasks** (`openspec/changes/{nombre}/tasks.md`): checklist numerado completable por sesión.
- **Apply**: implementación con TDD-strict (cada RED committeado antes del GREEN).
- **Verify**: code review multi-axis (5 ejes: correctness, readability, architecture, security, performance).
- **Archive**: move a `openspec/changes/archive/YYYY-MM-DD-{nombre}/`.

**Strict TDD mode** habilitado en `openspec/config.yaml`. Cada test rojo se commitea antes del feature.

**Persistencia:** hybrid (filesystem `openspec/` + Engram para cross-session recovery).

---

## Cambios recientes (changelog resumido)

| Fecha | Change | Descripción |
|---|---|---|
| 2026-08-10 | `param-tarifa-res-825-compliance-phase2` | Cierre de 8/10 gaps compliance CRA 825/2017 (fase 2). Ver `archive/2026-08-10-...` |
| 2026-08-03 | `factura-preview-print-bluetooth` | Preview de factura + impresión Bluetooth |
| 2026-08-03 | `parametros-tarifa-impeccable-v2` | Rediseño UI pantalla ParametrosTarifa |
| 2026-08-03 | `first-launch-post-reinstall-bug` | Fix bug de primer launch post-reinstall Expo |
| 2026-07-30 | `param-tarifa-res-825-compliance-phase1` | Compliance CRA 825 fase 1 (CMA mínimo, IPC, año base) |
| 2026-07-30 | `admin-parametros-tarifa-redesign` | Rediseño admin ParametrosTarifa |
| 2026-07-29 | `factura-compliance-fase1` + `factura-compliance-hardening` + `cleanup` | Compliance facturación CRA |
| 2026-07-09 | `setup-inicial-multi-tenant-auth` | Setup inicial + login + multi-tenant |
| 2026-05-19 | `clean-architecture-backend` | Migración backend .NET a Clean Architecture |
| 2026-05-03 | `aggregate-factura` + `persistencia-sqlite` | Refactor factura aggregate + persistencia SQLite |
| 2026-04-30 | `modulos-maestros` | Estructura inicial de módulos del dominio |

Lista completa en `openspec/changes/archive/`.

---

## Configuración

**URL del backend** se configura desde la pantalla CONFIG de la app móvil. Puerto por defecto: `http://<IP-servidor>:5180`.

IP WiFi del servidor dev: `192.168.40.48` (configurada en `backend/src/MediApp.Api/Properties/launchSettings.json` con binding `0.0.0.0:5180`).

**Backend connection string** (`backend/src/MediApp.Api/appsettings.json`):
```json
{
  "ConnectionStrings": {
    "Default": "Host=localhost;Database=mediapp;Username=...;Password=..."
  }
}
```

---

## Convenciones del proyecto

- **Español rioplatense (voseo)** en código, comentarios, docs y conversación.
- **Conventional commits en inglés** (subject ≤50 chars), sin Co-Authored-By, sin emojis.
- **Cada módulo** en `src/{modulo}/` con dominio puro (sin dependencias de framework) + tests colocados.
- **TDD-strict**: cada test rojo se commitea antes del verde.
- **Decisiones de diseño** documentadas con tradeoffs B/B/B (Bueno/Barato/Breve).
- **Mobile offline-first** (sync manual contra backend .NET).
- **Backend NO hashea passwords** — cliente usa SHA-256 antes del POST.
- **`passwordHash` NUNCA** se retorna en ninguna response.
- **Mobile**: usar `@expo/vector-icons`, nunca `react-native-vector-icons`.

---

## Documentación adicional

- `DOCUMENTACION_TECNICA.md`: arquitectura detallada, decisiones técnicas, modelo de datos v1.2.
- `MANUAL_DE_USUARIO.md`: manual para operarios de campo y administradores del prestador.
- `openspec/`: artifacts SDD completos (proposals, specs, designs, tasks, verify-reports).
- `.atl/skill-registry.md`: skills y convenciones del proyecto.
- `Documentos/Normativa-CRA/`: PDFs originales y markdown de resoluciones CRA.

---

## Autor

**Felipe Bernal Pachón** — Universidad de Cundinamarca, Ingeniería de Sistemas (2026)

Trabajo de grado. Cliente piloto: EPC Cundinamarca. Caso de uso: 2-3 prestadores rurales durante 3-5 días de prueba.
