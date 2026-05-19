using MediApp.Api.Dominio.Entidades;

namespace MediApp.Api.Features.Suscriptores;

/// <summary>Mapeos payload mobile -> entidad EF para Suscriptor.</summary>
public static class SuscriptorMapper
{
    public static Suscriptor PayloadAEntidad(SuscriptorPayload p) => new()
    {
        Codigo = p.Codigo,
        NombreApellidos = p.NombreApellidos,
        Direccion = p.Direccion,
        Estrato = p.Estrato,
        MatriculaInmobiliaria = p.MatriculaInmobiliaria,
        NumeroCatastral = p.NumeroCatastral,
        Estado = p.Estado,
        CreatedAt = p.CreatedAt,
        IdCliente = p.IdCliente
    };

    /// <summary>Aplica el payload a una entidad ya persistida (caso sobrescritura).</summary>
    public static void AplicarPayload(SuscriptorPayload p, Suscriptor entidad)
    {
        entidad.Codigo = p.Codigo;
        entidad.NombreApellidos = p.NombreApellidos;
        entidad.Direccion = p.Direccion;
        entidad.Estrato = p.Estrato;
        entidad.MatriculaInmobiliaria = p.MatriculaInmobiliaria;
        entidad.NumeroCatastral = p.NumeroCatastral;
        entidad.Estado = p.Estado;
        entidad.CreatedAt = p.CreatedAt;
        // IdCliente NO se cambia: es la identidad logica.
    }
}
