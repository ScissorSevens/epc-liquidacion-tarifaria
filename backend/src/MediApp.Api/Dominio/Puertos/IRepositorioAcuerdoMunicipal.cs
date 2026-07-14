namespace MediApp.Api.Dominio.Puertos;

using MediApp.Api.Dominio.Entidades;

/// <summary>
/// Puerto del repositorio de Acuerdos Municipales (topes subsidio/contribucion).
/// Implementacion EF: <c>Infraestructura.Repositorios.RepositorioAcuerdoMunicipalEF</c>.
/// </summary>
public interface IRepositorioAcuerdoMunicipal
{
    /// <summary>Lista acuerdos del prestador (ordenados por vigente_desde desc).</summary>
    Task<IReadOnlyList<AcuerdoMunicipal>> ListarPorPrestadorAsync(
        int idPrestador,
        CancellationToken ct = default);

    /// <summary>Busca por PK.</summary>
    Task<AcuerdoMunicipal?> BuscarPorIdAsync(int idAcuerdo, CancellationToken ct = default);

    /// <summary>
    /// Retorna el Acuerdo vigente del prestador en la fecha dada.
    /// Null si no hay Acuerdo vigente (caso legacy: usa factores L142/1994 directamente).
    /// </summary>
    Task<AcuerdoMunicipal?> BuscarVigenteAsync(
        int idPrestador,
        DateTime fecha,
        CancellationToken ct = default);

    /// <summary>Persiste un nuevo Acuerdo. Valida solapamiento de vigencia.</summary>
    Task<AcuerdoMunicipal> CrearAsync(AcuerdoMunicipal acuerdo, CancellationToken ct = default);

    /// <summary>Aplica cambios (los Acuerdos historicos son inmutables: NO se permite update).</summary>
    /// <exception cref="InvalidOperationException">Si el acuerdo ya paso a historico.</exception>
    Task<AcuerdoMunicipal> ActualizarAsync(int idAcuerdo, AcuerdoMunicipal cambios, CancellationToken ct = default);
}
