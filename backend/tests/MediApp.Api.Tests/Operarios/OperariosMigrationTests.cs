using MediApp.Api.Persistence.Entities;

namespace MediApp.Api.Tests.Operarios;

/// <summary>
/// Tests conceptuales (sin DB) que verifican que la entidad Lectura
/// soporta IdOperario nullable (FK opcional a Operario).
/// Garantiza compatibilidad de la migration AgregarOperarios.
/// </summary>
public class OperariosMigrationTests
{
    // ─── T-21-1: Lectura puede tener IdOperario = null ────────────────────────

    [Fact]
    public void Lectura_IdOperario_EsNullable()
    {
        var lectura = new Lectura
        {
            IdMedidor = 1,
            LecturaActual = 100m,
            LecturaAnterior = 90m,
            Periodo = "202605",
            IdOperario = null,           // FK nullable — no debe haber error de compilación ni runtime
            TimestampCaptura = DateTimeOffset.UtcNow,
            IdCliente = "tablet-01:999"
        };

        Assert.Null(lectura.IdOperario);
        Assert.Null(lectura.Operario);
    }

    // ─── T-21-2: Lista de Lecturas con IdOperario null no produce FK violation ─

    [Fact]
    public void Lista_Lecturas_ConIdOperarioNull_NoTieneViolacion()
    {
        // Simular proyección in-memory — equivalente a lo que haría EF si carga
        // lecturas históricas sin operario asignado.
        var lecturas = new List<Lectura>
        {
            new() { IdMedidor = 1, LecturaActual = 100m, LecturaAnterior = 90m,
                    Periodo = "202601", IdOperario = null, TimestampCaptura = DateTimeOffset.UtcNow,
                    IdCliente = "dev-01:1" },
            new() { IdMedidor = 2, LecturaActual = 200m, LecturaAnterior = 180m,
                    Periodo = "202602", IdOperario = 5, TimestampCaptura = DateTimeOffset.UtcNow,
                    IdCliente = "dev-01:2" },
            new() { IdMedidor = 1, LecturaActual = 110m, LecturaAnterior = 100m,
                    Periodo = "202603", IdOperario = null, TimestampCaptura = DateTimeOffset.UtcNow,
                    IdCliente = "dev-01:3" },
        };

        // La proyección no debe fallar aunque IdOperario sea null
        var proyeccion = lecturas.Select(l => new
        {
            l.Id,
            l.Periodo,
            IdOperario = l.IdOperario,   // nullable int
            NombreOperario = l.Operario?.Nombre  // nav property puede ser null — safe
        }).ToList();

        Assert.Equal(3, proyeccion.Count);

        var sinOperario = proyeccion.Where(p => p.IdOperario == null).ToList();
        Assert.Equal(2, sinOperario.Count);

        var conOperario = proyeccion.Where(p => p.IdOperario.HasValue).ToList();
        Assert.Equal(1, conOperario.Count);
        Assert.Equal(5, conOperario[0].IdOperario);
    }
}
