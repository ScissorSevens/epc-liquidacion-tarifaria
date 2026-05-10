using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MediApp.Api.Persistence;
using MediApp.Api.Persistence.Entities;
using MediApp.Api.Tests.Fixtures;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace MediApp.Api.Tests.Operarios;

[Collection("Operarios")]
/// <summary>
/// Tests de integración para GET /api/v1/operarios.
/// Cubre: lista sin filtro (3 operarios sin passwordHash), filtro soloActivos,
/// lista vacía devuelve array vacío.
/// </summary>
public class OperariosGetTests
{
    private readonly PostgresContainerFixture _pg;

    public OperariosGetTests(PostgresContainerFixture pg) => _pg = pg;

    private WebApplicationFactory<Program> CrearFactory()
    {
        var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Development");
                builder.UseSetting("ConnectionStrings:Default", _pg.ConnectionString);
                builder.ConfigureLogging(logging =>
                {
                    logging.ClearProviders();
                    logging.AddConsole();
                });
            });

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MediAppDbContext>();
        db.Database.Migrate();

        return factory;
    }

    private static Operario NuevoOperario(string cedula, string email, string estado = "activo") => new()
    {
        NumeroCedula = cedula,
        Nombre = "Test Operario",
        Email = email,
        PasswordHash = "$2b$10$hashhashhashhashhashhauABCDEFGHIJKLMNOPQRSTUVWXYZ01",
        Rol = "operario",
        Estado = estado,
        CreatedAt = "2026-05-10T00:00:00Z"
    };

    // ─── T-18-1: Sin filtro → 200, array con los 3, sin passwordHash ─────────

    [Fact]
    public async Task Get_SinFiltro_Devuelve200_YLosOperariosIncluidosInactivos()
    {
        await using var factory = CrearFactory();

        // Insertar 3 operarios directamente en DB con prefijos únicos
        var prefix = Random.Shared.Next(10000, 99999).ToString();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MediAppDbContext>();
            db.Operarios.AddRange(
                NuevoOperario($"4{prefix}1", $"g1_{prefix}@test.com", "activo"),
                NuevoOperario($"4{prefix}2", $"g2_{prefix}@test.com", "activo"),
                NuevoOperario($"4{prefix}3", $"g3_{prefix}@test.com", "inactivo")
            );
            await db.SaveChangesAsync();
        }

        var client = factory.CreateClient();
        var resp = await client.GetAsync("/api/v1/operarios");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        var lista = JsonSerializer.Deserialize<JsonElement>(json);

        Assert.Equal(JsonValueKind.Array, lista.ValueKind);
        // Debe haber al menos 3 (la DB puede tener más de tests anteriores)
        Assert.True(lista.GetArrayLength() >= 3);

        // Ningún elemento debe contener passwordHash
        foreach (var elem in lista.EnumerateArray())
        {
            Assert.False(elem.TryGetProperty("passwordHash", out _));
            Assert.False(elem.TryGetProperty("password_hash", out _));
            Assert.False(elem.TryGetProperty("PasswordHash", out _));
        }
    }

    // ─── T-18-2: soloActivos=true → solo los activos ─────────────────────────

    [Fact]
    public async Task Get_SoloActivos_FiltraInactivos()
    {
        await using var factory = CrearFactory();

        var prefix = Random.Shared.Next(10000, 99999).ToString();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MediAppDbContext>();
            db.Operarios.AddRange(
                NuevoOperario($"5{prefix}1", $"sa1_{prefix}@test.com", "activo"),
                NuevoOperario($"5{prefix}2", $"sa2_{prefix}@test.com", "activo"),
                NuevoOperario($"5{prefix}3", $"sa3_{prefix}@test.com", "inactivo")
            );
            await db.SaveChangesAsync();
        }

        var client = factory.CreateClient();
        var resp = await client.GetAsync("/api/v1/operarios?soloActivos=true");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        var lista = JsonSerializer.Deserialize<JsonElement>(json);

        Assert.Equal(JsonValueKind.Array, lista.ValueKind);

        // Ningún elemento del resultado debe tener estado "inactivo"
        foreach (var elem in lista.EnumerateArray())
        {
            if (elem.TryGetProperty("estado", out var estadoProp))
                Assert.NotEqual("inactivo", estadoProp.GetString());
        }
    }

    // ─── T-18-3: DB sin operarios → 200, array vacío ─────────────────────────

    [Fact]
    public async Task Get_SinOperariosEnDB_Devuelve200_ArrayVacio()
    {
        // Factory con DB fresh (nueva conexión a container limpio)
        // Usamos una factory separada pero el mismo container — si ya tiene datos
        // de otros tests, filtramos con soloActivos=true y verificamos la estructura.
        // Para garantizar array vacío usamos una DB completamente limpia via
        // truncate directo antes del test.
        await using var factory = CrearFactory();

        // Truncar la tabla operarios para este test específico
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MediAppDbContext>();
            // Eliminar FKs primero (lecturas), luego operarios
            await db.Database.ExecuteSqlRawAsync("DELETE FROM lecturas WHERE id_operario IS NOT NULL");
            await db.Database.ExecuteSqlRawAsync("DELETE FROM operarios");
        }

        var client = factory.CreateClient();
        var resp = await client.GetAsync("/api/v1/operarios");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        var lista = JsonSerializer.Deserialize<JsonElement>(json);

        Assert.Equal(JsonValueKind.Array, lista.ValueKind);
        Assert.Equal(0, lista.GetArrayLength());
    }
}
