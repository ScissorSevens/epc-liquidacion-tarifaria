using System.Net;
using System.Net.Http.Json;
using MediApp.Api.Persistence;
using MediApp.Api.Persistence.Entities;
using MediApp.Api.Tests.Fixtures;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MediApp.Api.Tests.Operarios;

[Collection("Operarios")]
/// <summary>
/// Tests de integración para PATCH /api/v1/operarios/vincular-dispositivo.
/// Cubre: vinculación exitosa, re-vinculación idempotente, dispositivoId duplicado,
/// cédula no encontrada.
/// </summary>
public class OperariosVincularTests
{
    private readonly PostgresContainerFixture _pg;

    public OperariosVincularTests(PostgresContainerFixture pg) => _pg = pg;

    private WebApplicationFactory<Program> CrearFactory() => _pg.Factory;

    private const string PasswordPrueba = "Test1234!";
    // Hash BCrypt (work factor 4 para velocidad en tests) de "Test1234!"
    private static readonly string HashPrueba = BCrypt.Net.BCrypt.HashPassword(PasswordPrueba, workFactor: 4);

    private async Task<Operario> InsertarOperario(IServiceScope scope, string cedula, string email, string? dispositivoId = null)
    {
        var db = scope.ServiceProvider.GetRequiredService<MediAppDbContext>();
        var op = new Operario
        {
            NumeroCedula = cedula,
            Nombre = "Operario Vincular",
            Email = email,
            PasswordHash = HashPrueba,
            Rol = "operario",
            Estado = "activo",
            DispositivoId = dispositivoId,
            CreatedAt = "2026-05-10T00:00:00Z"
        };
        db.Operarios.Add(op);
        await db.SaveChangesAsync();
        return op;
    }

    // ─── T-20-1: Vinculación exitosa → 200, dispositivoId actualizado en DB ──

    [Fact]
    public async Task Patch_VincularDispositivoNuevo_Devuelve200_YActualizaDB()
    {
        var factory = CrearFactory();

        var prefix = Random.Shared.Next(10000, 99999).ToString();
        Operario op;
        using (var scope = factory.Services.CreateScope())
            op = await InsertarOperario(scope, $"9{prefix}1", $"v1_{prefix}@test.com");

        var client = factory.CreateClient();
        var deviceId = $"device-{prefix}-A";
        var payload = new { cedula = op.NumeroCedula, password = PasswordPrueba, dispositivoId = deviceId };
        var resp = await client.PatchAsJsonAsync("/api/v1/operarios/vincular-dispositivo", payload);

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        // Verificar en DB
        using var scopeV = factory.Services.CreateScope();
        var db = scopeV.ServiceProvider.GetRequiredService<MediAppDbContext>();
        var actualizado = await db.Operarios.FindAsync(op.Id);
        Assert.Equal(deviceId, actualizado!.DispositivoId);
    }

    // ─── T-20-2: Re-vinculación idempotente: mismo operario + mismo dispositivo → 200 ──

    [Fact]
    public async Task Patch_MismoDispositivoMismoOperario_EsIdempotente_Devuelve200()
    {
        var factory = CrearFactory();

        var prefix = Random.Shared.Next(10000, 99999).ToString();
        var deviceId = $"device-{prefix}-B";
        Operario op;
        using (var scope = factory.Services.CreateScope())
            op = await InsertarOperario(scope, $"9{prefix}2", $"v2_{prefix}@test.com", deviceId);

        var client = factory.CreateClient();
        var payload = new { cedula = op.NumeroCedula, password = PasswordPrueba, dispositivoId = deviceId };

        // Primera llamada
        var resp1 = await client.PatchAsJsonAsync("/api/v1/operarios/vincular-dispositivo", payload);
        Assert.Equal(HttpStatusCode.OK, resp1.StatusCode);

        // Segunda llamada con mismo body → sigue siendo 200
        var resp2 = await client.PatchAsJsonAsync("/api/v1/operarios/vincular-dispositivo", payload);
        Assert.Equal(HttpStatusCode.OK, resp2.StatusCode);
    }

    // ─── T-20-3: DispositivoId ya en otro operario → 409 ─────────────────────

    [Fact]
    public async Task Patch_DispositivoYaEnOtroOperario_Devuelve409()
    {
        var factory = CrearFactory();

        var prefix = Random.Shared.Next(10000, 99999).ToString();
        var deviceId = $"device-{prefix}-C";
        Operario op1, op2;
        using (var scope = factory.Services.CreateScope())
        {
            op1 = await InsertarOperario(scope, $"9{prefix}3", $"v3_{prefix}@test.com", deviceId);
            op2 = await InsertarOperario(scope, $"9{prefix}4", $"v4_{prefix}@test.com");
        }

        var client = factory.CreateClient();
        // Intentar vincular el mismo device a op2
        var payload = new { cedula = op2.NumeroCedula, password = PasswordPrueba, dispositivoId = deviceId };
        var resp = await client.PatchAsJsonAsync("/api/v1/operarios/vincular-dispositivo", payload);

        Assert.Equal(HttpStatusCode.Conflict, resp.StatusCode);
    }

    // ─── T-20-4: Cédula no encontrada → 404 ──────────────────────────────────

    [Fact]
    public async Task Patch_CedulaInexistente_Devuelve404()
    {
        var factory = CrearFactory();
        var client = factory.CreateClient();

        var payload = new { cedula = "000000", password = "cualquiera", dispositivoId = "device-inexistente" };
        var resp = await client.PatchAsJsonAsync("/api/v1/operarios/vincular-dispositivo", payload);

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }
}
