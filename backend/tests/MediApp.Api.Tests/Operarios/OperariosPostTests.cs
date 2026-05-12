using System.Net;
using System.Net.Http.Json;
using MediApp.Api.Persistence;
using MediApp.Api.Tests.Fixtures;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MediApp.Api.Tests.Operarios;

[Collection("Operarios")]
/// <summary>
/// Tests de integración para POST /api/v1/operarios.
/// Cubre: 201 alta exitosa (sin passwordHash en response), 409 cédula duplicada,
/// 409 email duplicado, 400 cédula inválida, 400 passwordHash vacío.
/// </summary>
public class OperariosPostTests
{
    private readonly PostgresContainerFixture _pg;

    public OperariosPostTests(PostgresContainerFixture pg) => _pg = pg;

    private WebApplicationFactory<Program> CrearFactory() => _pg.Factory;

    private static object PayloadValido(string cedula = "123456", string email = "op@test.com") => new
    {
        numeroCedula = cedula,
        nombre = "Juan Operario",
        email = email,
        passwordHash = "$2b$10$abcdefghijklmnopqrstuvuABCDEFGHIJKLMNOPQRSTUVWXYZ012",
        rol = "operario",
        estado = "activo",
        dispositivoId = (string?)null,
        createdAt = "2026-05-10T00:00:00Z"
    };

    // ─── T-17-1: Alta exitosa → 201, response NO contiene passwordHash ───────

    [Fact]
    public async Task Post_PayloadValido_Devuelve201_SinPasswordHash()
    {
        var factory = CrearFactory();
        var client = factory.CreateClient();

        var cedula = $"100{Random.Shared.Next(100000, 999999)}";
        var email = $"op{Random.Shared.Next(1000, 9999)}@test.com";
        var resp = await client.PostAsJsonAsync("/api/v1/operarios", PayloadValido(cedula, email));

        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);

        var json = await resp.Content.ReadAsStringAsync();
        Assert.DoesNotContain("password_hash", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("passwordHash", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("PasswordHash", json, StringComparison.OrdinalIgnoreCase);

        // Verificar que se guardó en DB
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MediAppDbContext>();
        Assert.Equal(1, await db.Operarios.CountAsync(o => o.NumeroCedula == cedula));
    }

    // ─── T-17-2: Cédula duplicada → 409 ──────────────────────────────────────

    [Fact]
    public async Task Post_CedulaDuplicada_Devuelve409()
    {
        var factory = CrearFactory();
        var client = factory.CreateClient();

        var cedula = $"200{Random.Shared.Next(100000, 999999)}";
        var email1 = $"a{Random.Shared.Next(1000, 9999)}@test.com";
        var email2 = $"b{Random.Shared.Next(1000, 9999)}@test.com";

        var resp1 = await client.PostAsJsonAsync("/api/v1/operarios", PayloadValido(cedula, email1));
        Assert.Equal(HttpStatusCode.Created, resp1.StatusCode);

        var resp2 = await client.PostAsJsonAsync("/api/v1/operarios", PayloadValido(cedula, email2));
        Assert.Equal(HttpStatusCode.Conflict, resp2.StatusCode);
    }

    // ─── T-17-3: Email duplicado → 409 ───────────────────────────────────────

    [Fact]
    public async Task Post_EmailDuplicado_Devuelve409()
    {
        var factory = CrearFactory();
        var client = factory.CreateClient();

        var cedula1 = $"300{Random.Shared.Next(100000, 999999)}";
        var cedula2 = $"301{Random.Shared.Next(100000, 999999)}";
        var email = $"dup{Random.Shared.Next(1000, 9999)}@test.com";

        var resp1 = await client.PostAsJsonAsync("/api/v1/operarios", PayloadValido(cedula1, email));
        Assert.Equal(HttpStatusCode.Created, resp1.StatusCode);

        var resp2 = await client.PostAsJsonAsync("/api/v1/operarios", PayloadValido(cedula2, email));
        Assert.Equal(HttpStatusCode.Conflict, resp2.StatusCode);
    }

    // ─── T-17-4: Cédula inválida "12" (< 6 dígitos) → 400 ───────────────────

    [Fact]
    public async Task Post_CedulaMenorA6Digitos_Devuelve400()
    {
        var factory = CrearFactory();
        var client = factory.CreateClient();

        var resp = await client.PostAsJsonAsync("/api/v1/operarios", PayloadValido("12", "v400@test.com"));

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    // ─── T-17-5: PasswordHash vacío → 400 ────────────────────────────────────

    [Fact]
    public async Task Post_PasswordHashVacio_Devuelve400()
    {
        var factory = CrearFactory();
        var client = factory.CreateClient();

        var payload = new
        {
            numeroCedula = "654321",
            nombre = "Test",
            email = "pwd@test.com",
            passwordHash = "",
            rol = "operario",
            estado = "activo",
            dispositivoId = (string?)null,
            createdAt = "2026-05-10T00:00:00Z"
        };

        var resp = await client.PostAsJsonAsync("/api/v1/operarios", payload);
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }
}
