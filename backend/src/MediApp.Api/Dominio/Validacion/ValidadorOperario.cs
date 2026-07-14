using System.Text.RegularExpressions;

namespace MediApp.Api.Dominio.Validacion;

/// <summary>
/// Validador puro del módulo OPERARIOS — reglas multi-tenant.
///
/// Espejo simétrico del validador mobile
/// <c>mobile/dominio/operarios/validador-operario.ts</c>. Las funciones
/// retornan <c>bool</c> para mantener el validador testeable sin acoplar a
/// strings de UI ni a FluentValidation.
///
/// Aplicar ANTES de persistir:
///   - <c>EsCedulaValida</c> → 6-12 dígitos (<c>^\d{6,12}$</c>).
///   - <c>EsNombreValido</c> → 1-150 caracteres.
///   - <c>EsEmailValido</c> → formato email RFC light; <c>null</c> o vacío
///     rechazados (la columna es <c>NOT NULL</c> en DB).
///   - <c>EsPasswordValida</c> → ≥ 8 caracteres crudos (espejo de
///     <c>passwordCumpleMinima</c> del mobile; el hash se valida aparte).
///   - <c>EsIdPrestadorValido</c> → entero > 0 (espejo de
///     <c>idPrestadorRequeridoValido</c>; <c>0</c> está reservado para
///     prestador legacy "EPC-LEGACY").
///   - <c>EsRolValido</c> → ∈ {operario, supervisor, admin}.
///   - <c>EsEstadoValido</c> → ∈ {activo, inactivo}.
/// </summary>
public static class ValidadorOperario
{
    private const int LONGITUD_NOMBRE_MAXIMA = 150;
    private const int PASSWORD_LONGITUD_MINIMA = 8;

    private static readonly string[] RolesValidos = { "operario", "supervisor", "admin" };
    private static readonly string[] EstadosValidos = { "activo", "inactivo" };

    private static readonly Regex CedulaRegex =
        new(@"^\d{6,12}$", RegexOptions.Compiled);

    private static readonly Regex EmailRegex =
        new(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled);

    /// <summary>
    /// Cédula del operario (6-12 dígitos). Mismo regex que mobile
    /// <c>REGEX_CEDULA = /^\d{6,12}$/</c> y backend <c>OperarioValidator</c>.
    /// </summary>
    public static bool EsCedulaValida(string? cedula)
    {
        return cedula is not null && CedulaRegex.IsMatch(cedula);
    }

    /// <summary>1-150 caracteres. La columna <c>nombre</c> es NOT NULL.</summary>
    public static bool EsNombreValido(string? nombre)
    {
        if (string.IsNullOrEmpty(nombre)) return false;
        return nombre.Length <= LONGITUD_NOMBRE_MAXIMA;
    }

    /// <summary>
    /// Email con formato RFC light (usuario@dominio.tld). Null o vacío
    /// rechazado: la columna <c>email</c> es NOT NULL en DB.
    /// </summary>
    public static bool EsEmailValido(string? email)
    {
        return email is not null && EmailRegex.IsMatch(email);
    }

    /// <summary>
    /// Contraseña cruda con longitud mínima de 8 caracteres. Espejo del
    /// validador mobile <c>passwordCumpleMinima</c>.
    ///
    /// Decisión: la validación opera sobre la contraseña CRUDA que llega
    /// del formulario. El hash (<c>PasswordHash</c>) se valida aparte en
    /// la columna <c>Operario.PasswordHash</c> (max 200 chars, NOT NULL).
    /// </summary>
    public static bool EsPasswordValida(string? password)
    {
        return password is not null && password.Length >= PASSWORD_LONGITUD_MINIMA;
    }

    /// <summary>
    /// <c>id_prestador</c> &gt; 0 (entero positivo). Espejo del validador
    /// mobile <c>idPrestadorRequeridoValido</c>. <c>0</c> está reservado
    /// para el prestador legacy "EPC-LEGACY" (ver migration 009).
    /// </summary>
    public static bool EsIdPrestadorValido(int idPrestador)
    {
        return idPrestador > 0;
    }

    /// <summary>Rol ∈ {operario, supervisor, admin}. Case-sensitive.</summary>
    public static bool EsRolValido(string? rol)
    {
        return rol is not null && Array.IndexOf(RolesValidos, rol) >= 0;
    }

    /// <summary>Estado ∈ {activo, inactivo}. Case-sensitive.</summary>
    public static bool EsEstadoValido(string? estado)
    {
        return estado is not null && Array.IndexOf(EstadosValidos, estado) >= 0;
    }
}
