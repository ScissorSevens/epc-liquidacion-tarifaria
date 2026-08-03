using MediApp.Api.Dominio.Entidades;

namespace MediApp.Api.Dominio.Puertos;

/// <summary>
/// Puerto de repositorio para la entidad SyncRegistro.
/// La capa de Infraestructura provee la implementación concreta.
/// </summary>
public interface IRepositorioSyncRegistro
{
    Task<SyncRegistro?> BuscarPorClienteYTipoAsync(string idCliente, string tipo, CancellationToken ct = default);
    Task AgregarAsync(SyncRegistro registro, CancellationToken ct = default);
    Task GuardarCambiosAsync(CancellationToken ct = default);
}
