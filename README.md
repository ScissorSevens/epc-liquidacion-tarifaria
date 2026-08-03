# MediApp — Sistema de Liquidación Tarifaria EPC Cundinamarca

Solución full-stack para prestadores rurales de agua potable vinculados a **Empresas Públicas de Cundinamarca (EPC)**. Automatiza la captura de lecturas de medidores en campo (modo offline) y el cálculo de liquidaciones tarifarias según la normativa CRA (Resolución 688/2014).

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Dominio puro | TypeScript 5, Jest + ts-jest |
| Aplicación móvil | React Native + Expo SDK, expo-sqlite |
| Backend | .NET 8, ASP.NET Core Minimal API, EF Core 8 |
| Base de datos servidor | PostgreSQL 16 |
| Base de datos local | SQLite (expo-sqlite) |
| Dashboard web | HTML5 estático, Vanilla JS, bcrypt.js |

---

## Estructura del repositorio

```
sistema/
├── src/                        # Dominio puro TypeScript (motor tarifario, repos, casos de uso)
│   ├── motor-tarifario/        # Cálculo CRA: cargo fijo, consumo básico, excedente, subsidio
│   ├── suscriptores/           # Dominio de suscriptores
│   ├── lecturas/               # Dominio de lecturas
│   ├── medidores/              # Dominio de medidores
│   ├── operarios/              # Dominio de operarios
│   ├── sincronizacion/         # Cola de sincronización offline
│   ├── importacion/            # Importación masiva desde CSV
│   └── persistencia/           # Adaptadores SQLite (tests de integración)
├── mobile/                     # App Android (Expo + React Native)
│   └── src/
│       ├── pantallas/          # Pantallas: RutaDeHoy, CapturarLectura, Sync, etc.
│       ├── persistencia/       # Repositorios expo-sqlite
│       └── composition/        # Bootstrap (inyección de dependencias)
└── backend/                    # API REST (.NET 8) + Dashboard web
    └── src/MediApp.Api/
        ├── Features/           # Operarios, Suscriptores, Medidores, Lecturas, Liquidaciones
        ├── Persistence/        # EF Core + migraciones PostgreSQL
        └── wwwroot/            # Dashboard HTML estático
```

---

## Pruebas automatizadas

| Suite | Runner | Pruebas |
|---|---|---|
| Dominio TypeScript (`src/`) | Jest + ts-jest | 592 ✅ |
| Mobile (`mobile/`) | jest-expo + RNTL | 52 ✅ |
| Backend .NET (`backend/`) | xUnit | 38 |
| **Total** | | **682** |

```bash
# Tests del dominio TypeScript
cd sistema
npm test

# Tests mobile
cd sistema/mobile
npx jest --no-coverage

# Tests backend .NET
cd sistema/backend
dotnet test
```

---

## Comandos principales

### Backend

```bash
# Aplicar migraciones
cd backend/src/MediApp.Api
dotnet ef database update

# Ejecutar servidor (puerto 5180)
dotnet run --project backend/src/MediApp.Api
```

### App móvil

```bash
cd mobile
npx expo start
```

Escaneá el QR con **Expo Go** en Android (mismo WiFi que el servidor).

---

## Arquitectura offline-first

```
Dispositivo Android (sin internet)
  └── Captura lecturas + fotos → SQLite local → cola de sincronización
          │
          │  (cuando hay WiFi — acción manual del operario)
          ▼
Servidor local (red LAN del prestador)
  └── MediApp.Api → PostgreSQL → Dashboard web
```

---

## Auth (estado actual — 2026-07-09)

La app funciona **100% local sin backend** gracias al SDD `setup-inicial-multi-tenant-auth`:

- **Setup inicial**: wizard de 2 pasos en el primer inicio (configurar prestador + crear primer operario).
- **Login**: validación de cédula y contraseña contra SQLite local; la contraseña se compara mediante SHA-256.
- **Multi-tenant**: cada operario entra a SU prestador usando el `idPrestador` asociado en SQLite, sin valores hardcodeados.
- **Cerrar sesión**: disponible en **Mi Perfil → Gestión → Cerrar sesión**.
- **Token**: la sesión vence a las 24 horas; al vencer, un banner amarillo muestra "Tu sesión anterior venció" y vuelve a solicitar credenciales.
- **Legacy cleanup**: los datos residuales del bypass anterior se limpian automáticamente durante el arranque.

### Limitación actual

El token es fake (`fake-token-{timestamp}`). Cuando se implemente el backend real (Fase 6 del SDD), se reemplazará por un GUID generado por el backend .NET y la sesión se validará contra PostgreSQL.

### Roadmap

- **Fase 6**: backend real (`/api/v1/operarios/vincular-dispositivo`) con token GUID + `expiresAt`.
- **Fase 7**: pruebas E2E con backend real.
- **Fase 11**: documentación de despliegue.

### Tests del SDD

- **+377 pruebas verdes**: 192 unitarias + 64 de integración mobile + 25 E2E + 96 de backend conceptual.
- **0 regresiones nuevas**.
- **64 commits atómicos de implementación previos a PUNTO F**, con conventional commits.

---

## Configuración

La URL del servidor se configura desde la pantalla **CONFIG** de la app móvil.  
Puerto por defecto: `http://<IP-servidor>:5180`

Archivo de conexión del backend: `backend/src/MediApp.Api/appsettings.json`

```json
{
  "ConnectionStrings": {
    "Default": "Host=localhost;Database=mediapp;Username=...;Password=..."
  }
}
```

---

## Autor

**Felipe Bernal Pachón** — Universidad de Cundinamarca, Ingeniería de Sistemas (2026)
