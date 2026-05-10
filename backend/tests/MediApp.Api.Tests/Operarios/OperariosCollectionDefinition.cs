using MediApp.Api.Tests.Fixtures;
using Xunit;

namespace MediApp.Api.Tests.Operarios;

/// <summary>
/// Serializa todos los tests de Operarios para evitar múltiples WebApplicationFactory
/// concurrentes en el mismo proceso (que causa "logger already frozen" en Serilog).
/// La fixture PostgresContainerFixture es compartida entre todas las clases de esta collection.
/// </summary>
[CollectionDefinition("Operarios")]
public class OperariosCollectionDefinition : ICollectionFixture<PostgresContainerFixture>
{
}
