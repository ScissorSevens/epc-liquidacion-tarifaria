using DotNet.Testcontainers.Builders;
using Testcontainers.PostgreSql;

namespace MediApp.Api.Tests.Fixtures;

/// <summary>
/// Levanta un contenedor postgres:16-alpine efímero por cada xUnit collection que la use.
/// El puerto del host es asignado dinámicamente por Testcontainers (random) para no chocar
/// con el postgres real corriendo en 5433.
/// </summary>
public class PostgresContainerFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container;

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

    public Task InitializeAsync() => _container.StartAsync();

    public Task DisposeAsync() => _container.DisposeAsync().AsTask();
}
