using MediApp.Api.Persistence;
using MediApp.Api.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace MediApp.Api.Dev;

/// <summary>
/// Endpoint POST /api/v1/_dev/seed para cargar datos demo (solo Development).
/// Idempotente: si ya hay suscriptores cargados, no inserta de nuevo.
///
/// Inserta también los SyncRegistro correspondientes a cada entidad para que el cliente
/// pueda hacer POSTs reales sin chocar con FK orphans (los endpoints resuelven el FK
/// vía sync_registros).
/// </summary>
public static class SeedEndpoint
{
    private const string DispositivoSeed = "seed-01";
    private const string HashServerDummy = "0000000000000000000000000000000000000000000000000000000000000000";

    public static WebApplication MapDevEndpoints(this WebApplication app)
    {
        if (!app.Environment.IsDevelopment())
        {
            return app;
        }

        app.MapPost("/api/v1/_dev/seed", async (MediAppDbContext db, CancellationToken ct) =>
        {
            if (await db.Suscriptores.AnyAsync(ct))
            {
                return Results.Ok(new
                {
                    message = "Datos ya cargados",
                    suscriptores = await db.Suscriptores.CountAsync(ct)
                });
            }

            await using var tx = await db.Database.BeginTransactionAsync(ct);

            // 2 suscriptores
            var ahora = DateTimeOffset.UtcNow;
            var sus1 = new Suscriptor
            {
                Documento = "CC-SEED-001",
                Nombre = "María Demo",
                Direccion = "Vereda Demo 1",
                Estrato = 2,
                Estado = "activo",
                FechaAlta = ahora,
                IdCliente = $"{DispositivoSeed}:1"
            };
            var sus2 = new Suscriptor
            {
                Documento = "CC-SEED-002",
                Nombre = "Pedro Demo",
                Direccion = "Vereda Demo 2",
                Estrato = 3,
                Estado = "activo",
                FechaAlta = ahora,
                IdCliente = $"{DispositivoSeed}:2"
            };
            db.Suscriptores.AddRange(sus1, sus2);
            await db.SaveChangesAsync(ct);

            // 2 medidores (1 por suscriptor)
            var med1 = new Medidor
            {
                Codigo = "MED-SEED-001",
                IdSuscriptor = sus1.Id,
                FechaInstalacion = ahora,
                Estado = "activo",
                IdCliente = $"{DispositivoSeed}:10"
            };
            var med2 = new Medidor
            {
                Codigo = "MED-SEED-002",
                IdSuscriptor = sus2.Id,
                FechaInstalacion = ahora,
                Estado = "activo",
                IdCliente = $"{DispositivoSeed}:11"
            };
            db.Medidores.AddRange(med1, med2);
            await db.SaveChangesAsync(ct);

            // 1 lectura del medidor seed-01:10
            var lec1 = new Lectura
            {
                IdMedidor = med1.Id,
                LecturaActual = 125.500m,
                LecturaAnterior = 100.000m,
                Periodo = "202605",
                IdOperario = 1,
                TimestampCaptura = ahora,
                Observaciones = "Lectura demo seed",
                IdCliente = $"{DispositivoSeed}:100"
            };
            db.Lecturas.Add(lec1);
            await db.SaveChangesAsync(ct);

            // 1 liquidación para esa lectura
            var liq1 = new Liquidacion
            {
                IdLectura = lec1.Id,
                ConsumoM3 = 25.500m,
                CargoFijo = 5000.00m,
                CargoBasico = 8000.00m,
                CargoExcedente = 0.00m,
                Subsidio = 1000.00m,
                Contribucion = 0.00m,
                Total = 12000.00m,
                Estrato = 2,
                IdCliente = $"{DispositivoSeed}:1000"
            };
            db.Liquidaciones.Add(liq1);
            await db.SaveChangesAsync(ct);

            // SyncRegistro por entidad (hash dummy: el seed no proviene de un cliente real).
            db.SyncRegistros.AddRange(
                Sync("suscriptor", sus1.IdCliente, sus1.Id, ahora),
                Sync("suscriptor", sus2.IdCliente, sus2.Id, ahora),
                Sync("medidor", med1.IdCliente, med1.Id, ahora),
                Sync("medidor", med2.IdCliente, med2.Id, ahora),
                Sync("lectura", lec1.IdCliente, lec1.Id, ahora),
                Sync("liquidacion", liq1.IdCliente, liq1.Id, ahora));
            await db.SaveChangesAsync(ct);

            await tx.CommitAsync(ct);

            return Results.Ok(new
            {
                suscriptores = 2,
                medidores = 2,
                lecturas = 1,
                liquidaciones = 1
            });
        });

        return app;
    }

    private static SyncRegistro Sync(string tipo, string idCliente, int idEntidad, DateTimeOffset ts) => new()
    {
        Tipo = tipo,
        IdCliente = idCliente,
        IdEntidad = idEntidad,
        // HashServer dummy (64 chars hex). No representa hash real porque el seed no viene del mobile.
        HashServer = HashServerDummy,
        FechaSync = ts
    };
}
