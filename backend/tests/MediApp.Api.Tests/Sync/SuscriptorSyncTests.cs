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

        // Verificación directa en DB. Filtramos por idCliente porque la fixture comparte la DB
        // entre tests de la clase (xUnit corre tests de la misma clase secuencialmente).
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MediAppDbContext>();
        Assert.Equal(1, db.Suscriptores.Count(s => s.IdCliente == "tablet-01:42"));
        var sync = db.SyncRegistros.Single(sr => sr.IdCliente == "tablet-01:42" && sr.Tipo == "suscriptor");
        Assert.Equal(HashValido, sync.HashServer);
        Assert.Equal(body.IdServer, sync.IdEntidad);
    }

    [Fact]
    public async Task Post_MismoIdClienteYHash_DevuelveOk200Idempotente()
    {
        await using var factory = CrearFactory();
        var client = factory.CreateClient();

        // Usamos un idCliente único por test para no chocar con otros (DB compartida en la fixture).
        var idCliente = "tablet-02:100";
        var payload = new
        {
            documento = "CC-2222",
            nombre = "Ana Gómez",
            direccion = (string?)null,
            estrato = (short)3,
            estado = "activo",
            fechaAlta = DateTimeOffset.UtcNow,
            idCliente
        };
        var sobre = SobreSync(payload, idCliente, HashValido);

        // 1ra POST: 201
        var resp1 = await client.PostAsJsonAsync("/api/v1/suscriptores", sobre);
        Assert.Equal(HttpStatusCode.Created, resp1.StatusCode);
        var body1 = await resp1.Content.ReadFromJsonAsync<SyncRespDto>();
        Assert.NotNull(body1);

        // 2da POST con MISMO body (mismo idCliente, mismo hash): 200 idempotente.
        var resp2 = await client.PostAsJsonAsync("/api/v1/suscriptores", sobre);
        Assert.Equal(HttpStatusCode.OK, resp2.StatusCode);
        var body2 = await resp2.Content.ReadFromJsonAsync<SyncRespDto>();
        Assert.NotNull(body2);

        // El idServer debe ser el mismo en ambas respuestas.
        Assert.Equal(body1!.IdServer, body2!.IdServer);
        Assert.Equal(body1.HashServer, body2.HashServer);

        // En DB: UNA sola fila en suscriptores (con ese idCliente) y UNA sola en sync_registros (idCliente, suscriptor).
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MediAppDbContext>();
        Assert.Equal(1, db.Suscriptores.Count(s => s.IdCliente == idCliente));
        Assert.Equal(1, db.SyncRegistros.Count(sr => sr.IdCliente == idCliente && sr.Tipo == "suscriptor"));
    }

    [Fact]
    public async Task Post_MismoIdClienteHashDistintoSinForzar_DevuelveConflict409ConHashServer()
    {
        await using var factory = CrearFactory();
        var client = factory.CreateClient();

        var idCliente = "tablet-03:200";
        const string hashA = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
        const string hashB = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

        var payloadA = new
        {
            documento = "CC-3333",
            nombre = "Carlos Ruiz",
            direccion = "Calle 1",
            estrato = (short)2,
            estado = "activo",
            fechaAlta = DateTimeOffset.UtcNow,
            idCliente
        };
        var sobreA = SobreSync(payloadA, idCliente, hashA);

        var resp1 = await client.PostAsJsonAsync("/api/v1/suscriptores", sobreA);
        Assert.Equal(HttpStatusCode.Created, resp1.StatusCode);

        // Payload con datos diferentes (cambia nombre y direccion) y hash distinto.
        var payloadB = new
        {
            documento = "CC-3333",
            nombre = "Carlos Ruiz Modificado",
            direccion = "Calle 999",
            estrato = (short)2,
            estado = "activo",
            fechaAlta = DateTimeOffset.UtcNow,
            idCliente
        };
        var sobreB = SobreSync(payloadB, idCliente, hashB, forzar: false);

        var resp2 = await client.PostAsJsonAsync("/api/v1/suscriptores", sobreB);
        Assert.Equal(HttpStatusCode.Conflict, resp2.StatusCode);

        // El body debe ser ProblemDetails con extension property `hashServer` igual al hash original (hashA).
        var conflict = await resp2.Content.ReadFromJsonAsync<ConflictDto>();
        Assert.NotNull(conflict);
        Assert.Equal(409, conflict!.Status);
        Assert.Equal(hashA, conflict.HashServer);

        // En DB: NO se modificó el suscriptor ni se actualizó el hash en sync_registros.
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MediAppDbContext>();
        var sus = db.Suscriptores.Single(s => s.IdCliente == idCliente);
        Assert.Equal("Carlos Ruiz", sus.NombreApellidos);
        var sync = db.SyncRegistros.Single(sr => sr.IdCliente == idCliente && sr.Tipo == "suscriptor");
        Assert.Equal(hashA, sync.HashServer);
    }

    private record SyncRespDto(int IdServer, string HashServer);

    private record ConflictDto(int Status, string HashServer);
}
