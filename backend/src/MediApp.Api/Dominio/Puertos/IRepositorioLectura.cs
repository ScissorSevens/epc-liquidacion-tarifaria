using MediApp.Api.Dominio.Entidades;

namespace MediApp.Api.Dominio.Puertos;

/// <summary>
/// Puerto de repositorio para la entidad Lectura.
/// La capa de Infraestructura provee la implementación concreta.
/// </summary>
public interface IRepositorioLectura
{
    Task<IReadOnlyList<Lectura>> ListarAsync(CancellationToken ct = default);
    Task<Lectura?> ObtenerPorIdAsync(int id, CancellationToken ct = default);
    Task AgregarAsync(Lectura entidad, CancellationToken ct = default);
    Task GuardarCambiosAsync(CancellationToken ct = default);
    Task<bool> ExisteMedidorAsync(int idMedidor, CancellationToken ct = default);
}
