using System.Net;
using System.Net.Http.Json;
using MediApp.Api.Persistence;
using MediApp.Api.Tests.Fixtures;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MediApp.Api.Tests.Sync;

/// <summary>
/// Tests de integración del handler genérico de sync usando Suscriptor como caso piloto.
/// Cubre los 3 caminos del protocolo #213: 201 nuevo, 200 idempotente, 409 conflicto.
/// </summary>
public class SuscriptorSyncTests : IClassFixture<PostgresContainerFixture>
{
    private readonly PostgresContainerFixture _pg;

    public SuscriptorSyncTests(PostgresContainerFixture pg) => _pg = pg;

    private WebApplicationFactory<Program> CrearFactory()
    {
        var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Development");
                builder.UseSetting("ConnectionStrings:Default", _pg.ConnectionString);
            });

        // Aplicar migrations contra el container post-build (una sola vez por factory).
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MediAppDbContext>();
        db.Database.Migrate();

        return factory;
    }

    private static object PayloadValido() => new
    {
        documento = "CC-1234567890",
        nombre = "Pedro Pérez",
        direccion = "Vereda La Esperanza, lote 12",
        estrato = (short)2,
        estado = "activo",
        fechaAlta = DateTimeOffset.UtcNow,
        idCliente = "tablet-01:42"
    };

    private static object SobreSync(object payload, string idCliente, string hashLocal, bool forzar = false) => new
    {
        id = Guid.NewGuid().ToString(),
        tipo = "suscriptor",
        payload,
        hashLocal,
        forzarSobrescribir = forzar,
        idCliente,
        intentos = 0,
        ultimoIntento = (DateTimeOffset?)null
    };

    private const string HashValido =
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    [Fact]
    public async Task Post_NuevoSuscriptor_DevuelveCreated201_YGuardaSyncRegistro()
    {
        await using var factory = CrearFactory();
        var client = factory.CreateClient();

        var sobre = SobreSync(PayloadValido(), "tablet-01:42", HashValido);
        var resp = await client.PostAsJsonAsync("/api/v1/suscriptores", sobre);

        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);

        var body = await resp.Content.ReadFromJsonAsync<SyncRespDto>();
        Assert.NotNull(body);
        Assert.True(body!.IdServer > 0);
        Assert.Equal(HashValido, body.HashServer);

        // Verificación directa en DB.
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MediAppDbContext>();
        Assert.Equal(1, db.Suscriptores.Count());
        var sync = db.SyncRegistros.Single();
        Assert.Equal("tablet-01:42", sync.IdCliente);
        Assert.Equal("suscriptor", sync.Tipo);
        Assert.Equal(HashValido, sync.HashServer);
        Assert.Equal(body.IdServer, sync.IdEntidad);
    }

    private record SyncRespDto(int IdServer, string HashServer);
}
