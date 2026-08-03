using MediApp.Api.Dominio.Entidades;

namespace MediApp.Api.Aplicacion.Liquidaciones;

/// <summary>Contrato del servicio de aplicación para la gestión de Liquidaciones.</summary>
public interface IServicioLiquidaciones
{
    Task<IReadOnlyList<Liquidacion>> ListarAsync(CancellationToken ct = default);

    /// <summary>Multi-tenant: lista las liquidaciones del prestador (Q9 spec filtro).</summary>
    Task<IReadOnlyList<Liquidacion>> ListarPorPrestadorAsync(int idPrestador, CancellationToken ct = default);

    Task<Liquidacion?> ObtenerPorIdAsync(int id, CancellationToken ct = default);
    Task<bool> ExisteLecturaAsync(int idLectura, CancellationToken ct = default);

    /// <summary>
    /// Persiste una nueva liquidación. Si id_prestador &gt; 0 revalida
    /// contra el AcuerdoMunicipal vigente (ver ServicioLiquidaciones).
    /// </summary>
    Task AgregarAsync(Liquidacion entidad, CancellationToken ct = default);
}
