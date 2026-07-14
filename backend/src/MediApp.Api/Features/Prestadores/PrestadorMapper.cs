using MediApp.Api.Dominio.Entidades;

namespace MediApp.Api.Features.Prestadores;

/// <summary>Mapeos payload mobile/admin <-> entidad EF para Prestador.</summary>
public static class PrestadorMapper
{
    public static Prestador PayloadAEntidad(PrestadorPayload p) => new()
    {
        Codigo = p.Codigo,
        Nombre = p.Nombre,
        Nit = p.Nit,
        RepresentanteLegal = p.RepresentanteLegal,
        RepresentanteLegalCedula = p.RepresentanteLegalCedula,
        Municipio = p.Municipio,
        Departamento = p.Departamento,
        Segmento = p.Segmento,
        NumSuscriptoresUrbanos = p.NumSuscriptoresUrbanos,
        NumSuscriptoresRurales = p.NumSuscriptoresRurales,
        Contacto = p.Contacto,
        Estado = p.Estado,
    };

    public static void AplicarPayload(PrestadorPayload p, Prestador entidad)
    {
        entidad.Codigo = p.Codigo;
        entidad.Nombre = p.Nombre;
        entidad.Nit = p.Nit;
        entidad.RepresentanteLegal = p.RepresentanteLegal;
        entidad.RepresentanteLegalCedula = p.RepresentanteLegalCedula;
        entidad.Municipio = p.Municipio;
        entidad.Departamento = p.Departamento;
        entidad.Segmento = p.Segmento;
        entidad.NumSuscriptoresUrbanos = p.NumSuscriptoresUrbanos;
        entidad.NumSuscriptoresRurales = p.NumSuscriptoresRurales;
        entidad.Contacto = p.Contacto;
        entidad.Estado = p.Estado;
    }
}
