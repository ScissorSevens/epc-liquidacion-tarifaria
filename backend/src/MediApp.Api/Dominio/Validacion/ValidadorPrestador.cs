using System.Text.RegularExpressions;

namespace MediApp.Api.Dominio.Validacion;

/// <summary>
/// Validador puro del módulo PRESTADORES — reglas multi-tenant.
///
/// Espejo simétrico del validador mobile
/// <c>mobile/dominio/prestadores/validador-prestador.ts</c>. Las funciones
/// retornan <c>bool</c> para mantener el validador testeable sin acoplar a
/// strings de UI ni a FluentValidation (la validación de payload en endpoints
/// sigue delegando a <c>Features/Prestadores/PrestadorValidator.cs</c>).
///
/// Aplicar ANTES de persistir:
///   - <c>EsCodigoValido</c> → 1-50 dígitos (<c>^\d{1,50}$</c>).
///   - <c>EsNombreValido</c> → 1-200 caracteres.
///   - <c>EsNitValido</c> → 1-20 caracteres.
///   - <c>EsRepresentanteLegalValido</c> → no vacío.
///   - <c>EsCedulaRepresentanteLegalValida</c> → 6-12 dígitos (<c>^\d{6,12}$</c>,
///     mismo regex que mobile <c>cedulaRepresentanteLegalValida</c>).
///   - <c>EsMunicipioValido</c> / <c>EsDepartamentoValido</c> → 1-100 caracteres.
///   - <c>EsSegmentoValido</c> → estrictamente 1 o 2 (Res CRA 825/2017 art. 6).
///   - <c>EsNumSuscriptoresUrbanosValido</c> / <c>EsNumSuscriptoresRuralesValido</c> → ≥ 0.
///
/// Decisión 2026-07-09: <c>EsCodigoValido</c> usa regex más estricto
/// (<c>^\d{1,50}$</c>) que el <c>PrestadorValidator</c> FluentValidation
/// preexistente (<c>^[A-Za-z0-9\-]{1,50}$</c>). Esto replica el contrato
/// del mobile para garantizar simetría cross-platform. Ambos coexisten.
/// </summary>
public static class ValidadorPrestador
{
    private const int LONGITUD_NOMBRE_MAXIMA = 200;
    private const int LONGITUD_NIT_MAXIMA = 20;
    private const int LONGITUD_MUNICIPIO_MAXIMA = 100;
    private const int LONGITUD_DEPARTAMENTO_MAXIMA = 100;

    private static readonly Regex CodigoRegex =
        new(@"^\d{1,50}$", RegexOptions.Compiled);

    private static readonly Regex CedulaRepresentanteLegalRegex =
        new(@"^\d{6,12}$", RegexOptions.Compiled);

    /// <summary>
    /// Acepta exclusivamente 1-50 dígitos numéricos. Sin letras, guiones,
    /// puntos ni espacios — mismo formato canónico que el regex mobile
    /// <c>REGEX_CODIGO = /^\d{1,50}$/</c>.
    /// </summary>
    public static bool EsCodigoValido(string? codigo)
    {
        return codigo is not null && CodigoRegex.IsMatch(codigo);
    }

    /// <summary>1-200 caracteres, no nulo, no whitespace-puro lo acepta (puede ser nombre válido).</summary>
    public static bool EsNombreValido(string? nombre)
    {
        if (string.IsNullOrEmpty(nombre)) return false;
        return nombre.Length <= LONGITUD_NOMBRE_MAXIMA;
    }

    /// <summary>1-20 caracteres, no nulo.</summary>
    public static bool EsNitValido(string? nit)
    {
        if (string.IsNullOrEmpty(nit)) return false;
        return nit.Length <= LONGITUD_NIT_MAXIMA;
    }

    /// <summary>No vacío. La longitud se delega a DataAnnotations de la entidad.</summary>
    public static bool EsRepresentanteLegalValido(string? valor)
    {
        return !string.IsNullOrEmpty(valor);
    }

    /// <summary>
    /// Cédula del representante legal (6-12 dígitos). Mismo regex que el
    /// validador mobile <c>cedulaRepresentanteLegalValida</c>.
    /// </summary>
    public static bool EsCedulaRepresentanteLegalValida(string? cedula)
    {
        return cedula is not null && CedulaRepresentanteLegalRegex.IsMatch(cedula);
    }

    /// <summary>1-100 caracteres, no nulo.</summary>
    public static bool EsMunicipioValido(string? municipio)
    {
        if (string.IsNullOrEmpty(municipio)) return false;
        return municipio.Length <= LONGITUD_MUNICIPIO_MAXIMA;
    }

    /// <summary>1-100 caracteres, no nulo.</summary>
    public static bool EsDepartamentoValido(string? departamento)
    {
        if (string.IsNullOrEmpty(departamento)) return false;
        return departamento.Length <= LONGITUD_DEPARTAMENTO_MAXIMA;
    }

    /// <summary>Estrictamente 1 o 2. Cualquier otro valor → false.</summary>
    public static bool EsSegmentoValido(short segmento)
    {
        return segmento == 1 || segmento == 2;
    }

    /// <summary>Entero ≥ 0.</summary>
    public static bool EsNumSuscriptoresUrbanosValido(int n)
    {
        return n >= 0;
    }

    /// <summary>Entero ≥ 0.</summary>
    public static bool EsNumSuscriptoresRuralesValido(int n)
    {
        return n >= 0;
    }
}
