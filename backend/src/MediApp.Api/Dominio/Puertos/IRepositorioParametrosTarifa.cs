namespace MediApp.Api.Dominio.Puertos;

using MediApp.Api.Dominio.Entidades;

/// <summary>
/// Puerto del repositorio de ParametrosTarifa (insumos del motor tarifario
/// conforme a Res CRA 825/2017 + 907/2019 art. 14).
/// Implementacion EF: <c>Infraestructura.Repositorios.RepositorioParametrosTarifaEF</c>.
/// </summary>
public interface IRepositorioParametrosTarifa
{
    /// <summary>Lista parametros del prestador.</summary>
    Task<IReadOnlyList<ParametrosTarifa>> ListarPorPrestadorAsync(
        int idPrestador,
        CancellationToken ct = default);

    /// <summary>Busca por PK.</summary>
    Task<ParametrosTarifa?> BuscarPorIdAsync(int idParametros, CancellationToken ct = default);

    /// <summary>
    /// Retorna los Parametros vigentes del prestador en la fecha dada.
    /// Null si no hay Parametros vigentes (no se puede liquidar).
    /// </summary>
    Task<ParametrosTarifa?> BuscarVigenteAsync(
        int idPrestador,
        DateTime fecha,
        CancellationToken ct = default);

    /// <summary>Busca por (id_prestador, periodo). Util para evitar duplicados.</summary>
    Task<ParametrosTarifa?> BuscarPorPeriodoAsync(
        int idPrestador,
        int periodo,
        CancellationToken ct = default);

    /// <summary>Persiste un nuevo set de Parametros.</summary>
    Task<ParametrosTarifa> CrearAsync(ParametrosTarifa parametros, CancellationToken ct = default);

    /// <summary>Aplica cambios. Solo vigente (no historico). Valida solapamiento.</summary>
    Task<ParametrosTarifa> ActualizarAsync(int idParametros, ParametrosTarifa cambios, CancellationToken ct = default);
}
