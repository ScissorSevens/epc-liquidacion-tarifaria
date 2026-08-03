using MediApp.Api.Dominio.Entidades;

namespace MediApp.Api.Features.Medidores;

/// <summary>Mapeos payload mobile -> entidad EF para Medidor.</summary>
public static class MedidorMapper
{
    /// <param name="idSuscriptor">Id server del Suscriptor ya resuelto por el endpoint.</param>
    public static Medidor PayloadAEntidad(MedidorPayload p, int idSuscriptor) => new()
    {
        NumeroMedidor = p.NumeroMedidor,
        IdSuscriptor = idSuscriptor,
        FechaInstalacion = p.FechaInstalacion,
        Estado = p.Estado,
        Observaciones = p.Observaciones,
        IdCliente = p.IdCliente
    };

    /// <summary>Aplica el payload a una entidad ya persistida (caso sobrescritura).</summary>
    public static void AplicarPayload(MedidorPayload p, Medidor entidad, int idSuscriptor)
    {
        entidad.NumeroMedidor = p.NumeroMedidor;
        entidad.IdSuscriptor = idSuscriptor;
        entidad.FechaInstalacion = p.FechaInstalacion;
        entidad.Estado = p.Estado;
        entidad.Observaciones = p.Observaciones;
        // IdCliente NO se cambia: es la identidad logica.
    }
}
