using MediApp.Api.Persistence.Entities;

namespace MediApp.Api.Features.Medidores;

/// <summary>Mapeos payload mobile ↔ entidad EF para Medidor.</summary>
public static class MedidorMapper
{
    /// <param name="idSuscriptor">Id server del Suscriptor ya resuelto por el endpoint.</param>
    public static Medidor PayloadAEntidad(MedidorPayload p, int idSuscriptor) => new()
    {
        Codigo = p.Codigo,
        IdSuscriptor = idSuscriptor,
        FechaInstalacion = p.FechaInstalacion,
        Estado = p.Estado,
        IdCliente = p.IdCliente
    };

    /// <summary>Aplica el payload a una entidad ya persistida (caso sobrescritura).</summary>
    public static void AplicarPayload(MedidorPayload p, Medidor entidad, int idSuscriptor)
    {
        entidad.Codigo = p.Codigo;
        entidad.IdSuscriptor = idSuscriptor;
        entidad.FechaInstalacion = p.FechaInstalacion;
        entidad.Estado = p.Estado;
        // IdCliente NO se cambia: es la identidad lógica.
    }
}
