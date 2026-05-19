using MediApp.Api.Dominio.Entidades;

namespace MediApp.Api.Aplicacion.Lecturas;

/// <summary>Contrato del servicio de aplicación para la gestión de Lecturas.</summary>
public interface IServicioLecturas
{
    Task<IReadOnlyList<Lectura>> ListarAsync(CancellationToken ct = default);
    Task<Lectura?> ObtenerPorIdAsync(int id, CancellationToken ct = default);
    Task<bool> ExisteMedidorAsync(int idMedidor, CancellationToken ct = default);
    Task AgregarAsync(Lectura entidad, CancellationToken ct = default);
}
