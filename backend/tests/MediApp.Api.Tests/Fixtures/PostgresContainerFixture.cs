using DotNet.Testcontainers.Builders;
using MediApp.Api.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;

namespace MediApp.Api.Tests.Fixtures;

/// <summary>
/// Levanta un contenedor postgres:16-alpine efímero por cada xUnit collection que la use.
/// El puerto del host es asignado dinámicamente por Testcontainers (random) para no chocar
/// con el postgres real corriendo en 5433.
/// La factory se crea una sola vez y se expone para que todos los tests la reutilicen,
/// evitando que Serilog se congele al intentar crear una segunda instancia de WebApplicationFactory.
/// </summary>
public class PostgresContainerFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container;
    private WebApplicationFactory<Program>? _factory;

    public PostgresContainerFixture()
    {
        _container = new PostgreSqlBuilder()
            .WithImage("postgres:16-alpine")
            .WithDatabase("mediapp_test")
            .WithUsername("mediapp")
            .WithPassword("mediapp_test")
            .WithWaitStrategy(Wait.ForUnixContainer().UntilCommandIsCompleted("pg_isready"))
            .Build();
    }

    /// <summary>Connection string apuntando al puerto random del container.</summary>
    public string ConnectionString => _container.GetConnectionString();

    /// <summary>
    /// Factory compartida con migraciones ya aplicadas. Los tests deben usar esta
    /// instancia en lugar de crear su propia WebApplicationFactory para evitar que
    /// Serilog lance "The logger is already frozen".
    /// </summary>
    public WebApplicationFactory<Program> Factory => _factory!;

    public async Task InitializeAsync()
    {
        await _container.StartAsync();

        // Crear la factory una sola vez y mantenerla viva durante toda la colección.
        // Aplicar migraciones aquí para que los tests individuales no compitan entre sí.
        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Development");
                builder.UseSetting("ConnectionStrings:Default", ConnectionString);
            });

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MediAppDbContext>();
        db.Database.Migrate();
    }

    public async Task DisposeAsync()
    {
        if (_factory is not null)
            await _factory.DisposeAsync();

        await _container.DisposeAsync();
    }
}
