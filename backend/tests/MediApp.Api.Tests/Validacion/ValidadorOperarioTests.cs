using MediApp.Api.Dominio.Validacion;

namespace MediApp.Api.Tests.Validacion;

/// <summary>
/// Tests conceptuales (sin DB) para <see cref="ValidadorOperario"/>.
///
/// Espejo simétrico del validador mobile <c>dominio/operarios/validador-operario.ts</c>.
/// Cobertura:
///   - cedula: 6-12 dígitos (<c>^\d{6,12}$</c>).
///   - email: formato válido (opcional, "" no se rechaza — campo nullable en backend).
///   - password_raw: ≥ 8 caracteres (espejo de <c>passwordCumpleMinima</c>).
///   - id_prestador: entero > 0 (espejo de <c>idPrestadorRequeridoValido</c>).
///   - rol ∈ {operario, supervisor, admin}.
///   - estado ∈ {activo, inactivo}.
///
/// Disciplina: cada método retorna <c>bool</c>. Los mensajes de error y la
/// política completa (longitudes máx, hashing, etc.) son responsabilidad de
/// la UI / FluentValidation, no del validador puro.
/// </summary>
public class ValidadorOperarioTests
{
    // ─── EsCedulaValida ─────────────────────────────────────────────────────────

    [Theory]
    [InlineData("123456")]      // 6 dígitos (límite inferior)
    [InlineData("1234567890")]  // 10 dígitos (típico colombiano)
    [InlineData("123456789012")] // 12 dígitos (límite superior)
    public void EsCedulaValida_Acepta6A12Digitos(string cedula)
    {
        Assert.True(ValidadorOperario.EsCedulaValida(cedula),
            $"Esperaba que '{cedula}' fuera válida");
    }

    [Theory]
    [InlineData("")]
    [InlineData("12345")]           // 5 dígitos
    [InlineData("1234567890123")]   // 13 dígitos
    [InlineData("ABC12345")]
    [InlineData("12.345.678")]
    [InlineData("123-456")]
    public void EsCedulaValida_RechazaInvalidas(string cedula)
    {
        Assert.False(ValidadorOperario.EsCedulaValida(cedula),
            $"Esperaba que '{cedula}' fuera inválida");
    }

    // ─── EsNombreValido ─────────────────────────────────────────────────────────

    [Theory]
    [InlineData("Ana Gómez")]
    [InlineData("A")]
    public void EsNombreValido_AceptaNoVacioHasta150(string nombre)
    {
        Assert.True(ValidadorOperario.EsNombreValido(nombre));
    }

    [Theory]
    [InlineData("")]
    public void EsNombreValido_RechazaVacio(string nombre)
    {
        Assert.False(ValidadorOperario.EsNombreValido(nombre));
    }

    [Fact]
    public void EsNombreValido_RechazaMasDe150Caracteres()
    {
        var nombreLargo = new string('x', 151);
        Assert.False(ValidadorOperario.EsNombreValido(nombreLargo));
    }

    // ─── EsEmailValido ──────────────────────────────────────────────────────────

    [Theory]
    [InlineData("ana@epc.co")]
    [InlineData("carlos.perez@epc.com.co")]
    [InlineData("user+tag@sub.example.org")]
    public void EsEmailValido_AceptaFormatoValido(string email)
    {
        Assert.True(ValidadorOperario.EsEmailValido(email));
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    [InlineData("carlos.epc.co")]    // sin @
    [InlineData("carlos@")]          // sin dominio
    [InlineData("carlos@epc")]       // sin TLD
    [InlineData("car los@epc.co")]  // con espacio
    [InlineData("@epc.co")]          // sin usuario
    public void EsEmailValido_RechazaInvalidosONulos(string? email)
    {
        Assert.False(ValidadorOperario.EsEmailValido(email));
    }

    // ─── EsPasswordValida ───────────────────────────────────────────────────────

    [Theory]
    [InlineData("abcdefgh")]        // 8 (límite inferior)
    [InlineData("MiPass2024!!")]
    [InlineData("12345678")]
    public void EsPasswordValida_AceptaOchoOMas(string password)
    {
        Assert.True(ValidadorOperario.EsPasswordValida(password));
    }

    [Theory]
    [InlineData("")]
    [InlineData("abc123")]   // 6
    [InlineData("abcdefg")]  // 7
    public void EsPasswordValida_RechazaMenosDeOcho(string password)
    {
        Assert.False(ValidadorOperario.EsPasswordValida(password));
    }

    // ─── EsIdPrestadorValido ────────────────────────────────────────────────────

    [Theory]
    [InlineData(1)]
    [InlineData(5)]
    [InlineData(100)]
    [InlineData(int.MaxValue)]
    public void EsIdPrestadorValido_AceptaEnterosPositivos(int idPrestador)
    {
        Assert.True(ValidadorOperario.EsIdPrestadorValido(idPrestador));
    }

    [Theory]
    [InlineData(0)]   // legacy sin prestador
    [InlineData(-1)]
    [InlineData(-999)]
    [InlineData(int.MinValue)]
    public void EsIdPrestadorValido_RechazaCeroYNegativos(int idPrestador)
    {
        Assert.False(ValidadorOperario.EsIdPrestadorValido(idPrestador));
    }

    // ─── EsRolValido ────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("operario")]
    [InlineData("supervisor")]
    [InlineData("admin")]
    public void EsRolValido_AceptaRolesValidos(string rol)
    {
        Assert.True(ValidadorOperario.EsRolValido(rol));
    }

    [Theory]
    [InlineData("")]
    [InlineData("root")]
    [InlineData("OPERARIO")]   // case-sensitive
    [InlineData("operário")]   // acento
    public void EsRolValido_RechazaRolesInvalidos(string rol)
    {
        Assert.False(ValidadorOperario.EsRolValido(rol));
    }

    [Fact]
    public void EsRolValido_RechazaNull()
    {
        Assert.False(ValidadorOperario.EsRolValido(null));
    }

    // ─── EsEstadoValido ─────────────────────────────────────────────────────────

    [Theory]
    [InlineData("activo")]
    [InlineData("inactivo")]
    public void EsEstadoValido_AceptaEstadosValidos(string estado)
    {
        Assert.True(ValidadorOperario.EsEstadoValido(estado));
    }

    [Theory]
    [InlineData("")]
    [InlineData("suspendido")]   // los prestadores usan 'suspendido', operarios NO
    [InlineData("ACTIVO")]       // case-sensitive
    [InlineData("borrado")]
    public void EsEstadoValido_RechazaEstadosInvalidos(string estado)
    {
        Assert.False(ValidadorOperario.EsEstadoValido(estado));
    }

    [Fact]
    public void EsEstadoValido_RechazaNull()
    {
        Assert.False(ValidadorOperario.EsEstadoValido(null));
    }
}
