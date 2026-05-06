using MediApp.Api.Persistence.Entities;

namespace MediApp.Api.Features.Suscriptores;

/// <summary>Mapeos payload mobile ↔ entidad EF para Suscriptor.</summary>
public static class SuscriptorMapper
{
    public static Suscriptor PayloadAEntidad(SuscriptorPayload p) => new()
    {
        Documento = p.Documento,
        Nombre = p.Nombre,
        Direccion = p.Direccion,
        Estrato = p.Estrato,
        Estado = p.Estado,
        FechaAlta = p.FechaAlta,
        IdCliente = p.IdCliente
    };

    /// <summary>Aplica el payload a una entidad ya persistida (caso sobrescritura).</summary>
    public static void AplicarPayload(SuscriptorPayload p, Suscriptor entidad)
    {
        entidad.Documento = p.Documento;
        entidad.Nombre = p.Nombre;
        entidad.Direccion = p.Direccion;
        entidad.Estrato = p.Estrato;
        entidad.Estado = p.Estado;
        entidad.FechaAlta = p.FechaAlta;
        // IdCliente NO se cambia: es la identidad lógica.
    }
}
