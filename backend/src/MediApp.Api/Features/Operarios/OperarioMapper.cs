using MediApp.Api.Persistence.Entities;

namespace MediApp.Api.Features.Operarios;

/// <summary>Mapeos entre payload HTTP y entidad EF para Operario.</summary>
public static class OperarioMapper
{
    /// <summary>
    /// Crea una nueva entidad Operario a partir de un payload de creación.
    /// El Id se deja en 0 para que EF lo asigne al insertar.
    /// </summary>
    public static Operario PayloadAEntidad(OperarioPayload p) => new()
    {
        NumeroCedula = p.NumeroCedula,
        Nombre = p.Nombre,
        Email = p.Email,
        PasswordHash = p.PasswordHash,
        Rol = p.Rol,
        Estado = p.Estado,
        DispositivoId = p.DispositivoId,
        CreatedAt = p.CreatedAt,
    };

    /// <summary>
    /// Aplica los campos no-null del payload de actualización sobre una entidad ya persistida.
    /// NumeroCedula es INMUTABLE: nunca se sobreescribe.
    /// </summary>
    public static void AplicarPayload(OperarioUpdatePayload p, Operario entidad)
    {
        if (p.Nombre is not null) entidad.Nombre = p.Nombre;
        if (p.Email is not null) entidad.Email = p.Email;
        if (p.PasswordHash is not null) entidad.PasswordHash = p.PasswordHash;
        if (p.Rol is not null) entidad.Rol = p.Rol;
        if (p.Estado is not null) entidad.Estado = p.Estado;
        if (p.DispositivoId is not null) entidad.DispositivoId = p.DispositivoId;
    }
}
