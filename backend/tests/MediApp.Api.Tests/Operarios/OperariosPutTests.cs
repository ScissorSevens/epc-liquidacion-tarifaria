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
/// Tests de integración para PUT /api/v1/operarios/{id}.
/// Cubre: soft-delete via estado=inactivo, 404 ID inexistente,
/// 409 email duplicado, campo numeroCedula ignorado.
/// </summary>
public class OperariosPutTests
{
    private readonly PostgresContainerFixture _pg;

    public OperariosPutTests(PostgresContainerFixture pg) => _pg = pg;

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

    private async Task<Operario> InsertarOperario(IServiceScope scope, string cedula, string email, string estado = "activo")
    {
        var db = scope.ServiceProvider.GetRequiredService<MediAppDbContext>();
        var op = new Operario
        {
            NumeroCedula = cedula,
            Nombre = "Operario Test",
            Email = email,
            PasswordHash = "$2b$10$hashhashhashhashhashhauABCDEFGHIJKLMNOPQRSTUVWXYZ01",
            Rol = "operario",
            Estado = estado,
            CreatedAt = "2026-05-10T00:00:00Z"
        };
        db.Operarios.Add(op);
        await db.SaveChangesAsync();
        return op;
    }

    // ─── T-19-1: Soft-delete via estado=inactivo → 200, queda inactivo en DB ─

    [Fact]
    public async Task Put_EstadoInactivo_Devuelve200_YOperarioEsInactivoEnDB()
    {
        await using var factory = CrearFactory();

        var prefix = Random.Shared.Next(10000, 99999).ToString();
        Operario op;
        using (var scope = factory.Services.CreateScope())
            op = await InsertarOperario(scope, $"6{prefix}1", $"put1_{prefix}@test.com");

        var client = factory.CreateClient();
        var payload = new { estado = "inactivo" };
        var resp = await client.PutAsJsonAsync($"/api/v1/operarios/{op.Id}", payload);

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        // Verificar en DB que el estado cambió
        using var scopeV = factory.Services.CreateScope();
        var db = scopeV.ServiceProvider.GetRequiredService<MediAppDbContext>();
        var actualizado = await db.Operarios.FindAsync(op.Id);
        Assert.Equal("inactivo", actualizado!.Estado);
    }

    // ─── T-19-2: ID inexistente → 404 ────────────────────────────────────────

    [Fact]
    public async Task Put_IdInexistente_Devuelve404()
    {
        await using var factory = CrearFactory();
        var client = factory.CreateClient();

        var resp = await client.PutAsJsonAsync("/api/v1/operarios/99999999", new { nombre = "X" });

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    // ─── T-19-3: Email duplicado con otro operario → 409 ─────────────────────

    [Fact]
    public async Task Put_EmailDuplicadoConOtroOperario_Devuelve409()
    {
        await using var factory = CrearFactory();

        var prefix = Random.Shared.Next(10000, 99999).ToString();
        Operario op1, op2;
        using (var scope = factory.Services.CreateScope())
        {
            op1 = await InsertarOperario(scope, $"7{prefix}1", $"e1_{prefix}@test.com");
            op2 = await InsertarOperario(scope, $"7{prefix}2", $"e2_{prefix}@test.com");
        }

        var client = factory.CreateClient();
        // Intentar poner en op2 el email de op1
        var payload = new { email = $"e1_{prefix}@test.com" };
        var resp = await client.PutAsJsonAsync($"/api/v1/operarios/{op2.Id}", payload);

        Assert.Equal(HttpStatusCode.Conflict, resp.StatusCode);
    }

    // ─── T-19-4: NumeroCedula en payload → campo ignorado, cedula no cambia ──

    [Fact]
    public async Task Put_NumeroCedulaEnPayload_EsIgnorado_YCedulaNoCambia()
    {
        await using var factory = CrearFactory();

        var prefix = Random.Shared.Next(10000, 99999).ToString();
        var cedulaOriginal = $"8{prefix}1";
        Operario op;
        using (var scope = factory.Services.CreateScope())
            op = await InsertarOperario(scope, cedulaOriginal, $"nc_{prefix}@test.com");

        var client = factory.CreateClient();
        // OperarioUpdatePayload no tiene NumeroCedula — aunque el cliente lo envíe, se ignora
        var payload = new { numeroCedula = "999999", nombre = "Nombre Cambiado" };
        var resp = await client.PutAsJsonAsync($"/api/v1/operarios/{op.Id}", payload);

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        // Verificar que la cédula NO cambió
        using var scopeV = factory.Services.CreateScope();
        var db = scopeV.ServiceProvider.GetRequiredService<MediAppDbContext>();
        var actualizado = await db.Operarios.FindAsync(op.Id);
        Assert.Equal(cedulaOriginal, actualizado!.NumeroCedula);
        Assert.Equal("Nombre Cambiado", actualizado.Nombre);
    }
}
