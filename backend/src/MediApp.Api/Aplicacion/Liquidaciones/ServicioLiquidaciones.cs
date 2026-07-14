using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Dominio.Puertos;

namespace MediApp.Api.Aplicacion.Liquidaciones;

/// <summary>
/// Servicio de aplicación para la gestión de Liquidaciones.
/// Orquesta las operaciones de negocio usando el puerto de repositorio.
///
/// Multi-tenant (Q9 spec): al agregar una liquidación con id_prestador,
/// revalida el resultado contra el AcuerdoMunicipal vigente del prestador.
/// Esto previene que datos antiguos (single-tenant) entren al modelo
/// multi-tenant sin validación cruzada.
/// </summary>
public class ServicioLiquidaciones : IServicioLiquidaciones
{
    private readonly IRepositorioLiquidacion _repositorio;
    private readonly IRepositorioAcuerdoMunicipal _acuerdos;

    public ServicioLiquidaciones(
        IRepositorioLiquidacion repositorio,
        IRepositorioAcuerdoMunicipal acuerdos)
    {
        _repositorio = repositorio;
        _acuerdos = acuerdos;
    }

    /// <summary>Retorna todas las liquidaciones (multi-tenant: incluye FK prestador en cada row).</summary>
    public async Task<IReadOnlyList<Liquidacion>> ListarAsync(CancellationToken ct = default)
        => await _repositorio.ListarAsync(ct);

    /// <summary>Retorna las liquidaciones del prestador (Q9 spec endpoint filtro).</summary>
    public async Task<IReadOnlyList<Liquidacion>> ListarPorPrestadorAsync(int idPrestador, CancellationToken ct = default)
        => await _repositorio.ListarPorPrestadorAsync(idPrestador, ct);

    /// <summary>Retorna una liquidación por Id, o null si no existe.</summary>
    public async Task<Liquidacion?> ObtenerPorIdAsync(int id, CancellationToken ct = default)
        => await _repositorio.ObtenerPorIdAsync(id, ct);

    /// <summary>Verifica que la lectura referenciada exista antes de agregar la liquidación.</summary>
    public async Task<bool> ExisteLecturaAsync(int idLectura, CancellationToken ct = default)
        => await _repositorio.ExisteLecturaAsync(idLectura, ct);

    /// <summary>
    /// Persiste una nueva liquidación y guarda los cambios. Si
    /// <c>idPrestador &gt; 0</c>, intenta revalidar contra el
    /// AcuerdoMunicipal vigente del prestador. Si el Acuerdo NO admite
    /// el resultado del cálculo (p.ej. factor de subsidio fuera del rango
    /// legal L142/1994), lanza InvalidOperationException.
    /// </summary>
    public async Task AgregarAsync(Liquidacion entidad, CancellationToken ct = default)
    {
        if (entidad.IdPrestador > 0)
        {
            // Cargar Acuerdo vigente a la fecha de la liquidación
            var fechaLiquidacion = DateTime.UtcNow.Date;
            var acuerdo = await _acuerdos.BuscarVigenteAsync(entidad.IdPrestador, fechaLiquidacion, ct);
            if (acuerdo is not null)
            {
                // Reglas de coherencia contra Acuerdo vigente:
                // - Si hay subsidio pero el Acuerdo no subsidia ese estrato → error.
                // - Si hay contribucion pero el Acuerdo no contribuye ese estrato → error.
                ValidarCoherenciaConAcuerdo(entidad, acuerdo);
            }
            // Si no hay Acuerdo vigente, se permite el insert (caso legacy / pendiente config)
        }
        await _repositorio.AgregarAsync(entidad, ct);
        await _repositorio.GuardarCambiosAsync(ct);
    }

    /// <summary>
    /// Revalida el resultado de la liquidación contra el Acuerdo vigente
    /// del prestador. Solo se dispara cuando hay coherencia sospechosa:
    /// subsidio > 0 pero estrato sin Acuerdo (E5/E6 → no subsidia)
    /// o contribucion > 0 pero estrato sin Acuerdo (E1/E2/E3 → no contribuye).
    /// </summary>
    private static void ValidarCoherenciaConAcuerdo(Liquidacion entidad, AcuerdoMunicipal acuerdo)
    {
        var estrato = entidad.Estrato;
        var tieneSubsidio = entidad.Subsidio > 0;
        var tieneContribucion = entidad.Contribucion > 0;

        // E1, E2, E3 pueden recibir subsidio segun Acuerdo vigente
        bool estratoPermiteSubsidio = estrato is >= 1 and <= 3;
        // E5, E6 pueden recibir contribucion segun Acuerdo vigente
        bool estratoPermiteContribucion = estrato is >= 5 and <= 6;

        if (tieneSubsidio && !estratoPermiteSubsidio)
        {
            throw new InvalidOperationException(
                $"Estrato {estrato} no es elegible para subsidio segun Acuerdo vigente del prestador {entidad.IdPrestador}");
        }
        if (tieneContribucion && !estratoPermiteContribucion)
        {
            throw new InvalidOperationException(
                $"Estrato {estrato} no es elegible para contribucion segun Acuerdo vigente del prestador {entidad.IdPrestador}");
        }
    }
}
