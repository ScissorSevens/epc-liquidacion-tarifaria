# MediApp Backend

API REST en .NET 8 (Minimal API) + PostgreSQL 16 + EF Core 8.

## Requisitos

- .NET SDK 8.0.300 (fijado por `global.json` con `rollForward: latestMinor`).
- Docker Desktop.
- (Opcional) `dotnet-ef` global tool para correr migrations.

## Arrancar local

```powershell
# 1. Levantar Postgres en Docker
docker compose -f backend/docker-compose.yml up -d db

# 2. Verificar healthcheck (debe decir "healthy")
docker compose -f backend/docker-compose.yml ps

# 3. Aplicar migrations
dotnet ef database update -p backend/src/MediApp.Api

# 4. Levantar API
dotnet run --project backend/src/MediApp.Api
```

API en `http://localhost:5080`. Healthcheck: `GET /health`. Swagger UI en `/swagger`.

## Por qué puerto 5433

El host tiene un servicio Windows `postgresql-x64-17` corriendo y ocupando el puerto **5432**.
Para evitar conflicto y NO tocar el Postgres personal del usuario, el container expone PG16 en el
puerto **5433** del host (mapeo `5433:5432`). Internamente el container sigue en 5432.

La connection string de DEV (`appsettings.Development.json`) usa `Port=5433`.

## Parar / limpiar

```powershell
# Parar (preserva el volumen con los datos)
docker compose -f backend/docker-compose.yml down

# Parar y BORRAR el volumen (datos perdidos)
docker compose -f backend/docker-compose.yml down -v
```

## Connection strings

- **DEV**: `appsettings.Development.json` → `ConnectionStrings:Default` con la password local
  `mediapp_dev`. Es solo para desarrollo, NO va a Azure.
- **PROD (Azure App Service)**: la connection string se inyecta vía variable de entorno
  `ConnectionStrings__Default`. NO la pongas en ningún `appsettings*.json`.

## Estructura

```
backend/
├── global.json                   # SDK pin
├── docker-compose.yml            # Postgres 16
├── MediApp.Backend.sln
├── src/MediApp.Api/
│   ├── Program.cs                # composition root + endpoints
│   ├── Persistence/              # DbContext + Entities + Migrations
│   ├── Features/                 # endpoints por feature (vacío Día 1)
│   ├── Common/                   # cross-cutting (vacío Día 1)
│   └── Infrastructure/           # adapters (vacío Día 1)
└── tests/MediApp.Api.Tests/
```
