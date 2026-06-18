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
        IdCliente = p.IdCliente,
        // Campos extendidos: asignacion directa (null si no vino, retrocompatible)
        Cedula = p.Cedula,
        Municipio = p.Municipio,
        Sector = p.Sector,
        AplicaSubsidio = p.AplicaSubsidio,
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
        // Campos extendidos: condicional para no borrar valores existentes con null payload
        if (p.Cedula is not null) entidad.Cedula = p.Cedula;
        if (p.Municipio is not null) entidad.Municipio = p.Municipio;
        if (p.Sector is not null) entidad.Sector = p.Sector;
        if (p.AplicaSubsidio is not null) entidad.AplicaSubsidio = p.AplicaSubsidio;
    }
}
