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

    private static readonly Regex IdClienteRegex =
        new(@"^[\w-]+:\d+$", RegexOptions.Compiled);

    public static bool EsSha256HexValido(string? valor) =>
        !string.IsNullOrEmpty(valor) && Sha256HexRegex.IsMatch(valor);

    public static bool EsIdClienteValido(string? valor) =>
        !string.IsNullOrEmpty(valor) && IdClienteRegex.IsMatch(valor);
}
