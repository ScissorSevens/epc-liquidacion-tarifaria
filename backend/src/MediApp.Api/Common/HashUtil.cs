using System.Text.RegularExpressions;

namespace MediApp.Api.Common;

/// <summary>
/// Validaciones de formato relacionadas con hashes e identificadores offline.
/// El backend NO calcula hashes — solo valida que vengan en el formato pactado con el mobile.
/// </summary>
public static class HashUtil
{
    private static readonly Regex Sha256HexRegex =
        new("^[a-f0-9]{64}$", RegexOptions.Compiled);

    // id_local es opaco para el server — solo requiere ser único y estable.
    // Aceptamos UUIDs (mobile) e IDs numéricos (seed). Ver decisión #222.
    private static readonly Regex IdClienteRegex =
        new(@"^[\w-]+:[\w-]+$", RegexOptions.Compiled);

    public static bool EsSha256HexValido(string? valor) =>
        !string.IsNullOrEmpty(valor) && Sha256HexRegex.IsMatch(valor);

    public static bool EsIdClienteValido(string? valor) =>
        !string.IsNullOrEmpty(valor) && IdClienteRegex.IsMatch(valor);
}
