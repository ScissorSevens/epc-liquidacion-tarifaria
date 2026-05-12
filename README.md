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
