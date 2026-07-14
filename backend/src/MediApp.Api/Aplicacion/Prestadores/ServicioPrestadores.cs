using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Dominio.Puertos;

namespace MediApp.Api.Aplicacion.Prestadores;

public interface IServicioPrestadores
{
    Task<(IReadOnlyList<Prestador> items, int total)> ListarAsync(
        string? estado,
        short? segmento,
        string? search,
        int page,
        int limit,
        CancellationToken ct = default);

    Task<Prestador?> ObtenerPorIdAsync(int idPrestador, CancellationToken ct = default);
    Task<Prestador> CrearAsync(Prestador prestador, CancellationToken ct = default);
    Task<Prestador> ActualizarAsync(int idPrestador, Prestador cambios, CancellationToken ct = default);
    Task<Prestador> SuspenderAsync(int idPrestador, CancellationToken ct = default);
    Task<Prestador> ReactivarAsync(int idPrestador, CancellationToken ct = default);
}

public class ServicioPrestadores : IServicioPrestadores
{
    private readonly IRepositorioPrestador _repo;

    public ServicioPrestadores(IRepositorioPrestador repo)
    {
        _repo = repo;
    }

    public async Task<(IReadOnlyList<Prestador> items, int total)> ListarAsync(
        string? estado,
        short? segmento,
        string? search,
        int page,
        int limit,
        CancellationToken ct = default)
    {
        // Cap defensivo de paginacion
        if (page < 1) page = 1;
        if (limit < 1) limit = 50;
        if (limit > 200) limit = 200;

        var items = await _repo.ListarAsync(estado, segmento, search, page, limit, ct);
        var total = await _repo.ContarAsync(estado, segmento, search, ct);
        return (items, total);
    }

    public async Task<Prestador?> ObtenerPorIdAsync(int idPrestador, CancellationToken ct = default)
        => await _repo.BuscarPorIdAsync(idPrestador, ct);

    public async Task<Prestador> CrearAsync(Prestador prestador, CancellationToken ct = default)
    {
        var existe = await _repo.ExistePorCodigoAsync(prestador.Codigo, ct);
        if (existe)
        {
            throw new InvalidOperationException(
                $"ya existe un prestador con codigo '{prestador.Codigo}'");
        }
        return await _repo.CrearAsync(prestador, ct);
    }

    public async Task<Prestador> ActualizarAsync(int idPrestador, Prestador cambios, CancellationToken ct = default)
        => await _repo.ActualizarAsync(idPrestador, cambios, ct);

    public async Task<Prestador> SuspenderAsync(int idPrestador, CancellationToken ct = default)
        => await _repo.SuspenderAsync(idPrestador, ct);

    public async Task<Prestador> ReactivarAsync(int idPrestador, CancellationToken ct = default)
        => await _repo.ReactivarAsync(idPrestador, ct);
}
