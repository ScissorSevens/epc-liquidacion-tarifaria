using MediApp.Api.Dominio.Validacion;

namespace MediApp.Api.Tests.Validacion;

/// <summary>
/// Tests conceptuales (sin DB) para <see cref="ValidadorPrestador"/>.
///
/// Espejo simétrico del validador mobile <c>dominio/prestadores/validador-prestador.ts</c>.
/// Cobertura:
///   - códigos numéricos 1-50 dígitos (regex <c>^\d{1,50}$</c>).
///   - longitudes máximas de nombre (200), nit (20), municipio (100), departamento (100).
///   - segmento ∈ {1, 2} (Res CRA 825/2017 art. 6).
///   - suscriptores urbanos/rurales ≥ 0.
///   - cédula representante legal 6-12 dígitos (mismo regex que
///     <c>cedulaRepresentanteLegalValida</c> del mobile).
///   - representante legal no vacío.
///
/// Disciplina: cada método retorna <c>bool</c>; los mensajes de error son
/// responsabilidad de la UI / FluentValidation, no del validador puro.
/// </summary>
public class ValidadorPrestadorTests
{
    // ─── EsCodigoValido ─────────────────────────────────────────────────────────

    [Theory]
    [InlineData("1")]
    [InlineData("12345")]
    [InlineData("12345678901234567890123456789012345678901234567890")] // 50 dígitos
    public void EsCodigoValido_AceptaDigitosDentroDeRango(string codigo)
    {
        Assert.True(ValidadorPrestador.EsCodigoValido(codigo),
            $"Esperaba que '{codigo}' fuera válido");
    }

    [Theory]
    [InlineData("")]
    [InlineData("ABC123")]
    [InlineData("12-345")]
    [InlineData("12.345")]
    [InlineData(" 12345")]
    [InlineData("123456789012345678901234567890123456789012345678901")] // 51 dígitos
    public void EsCodigoValido_RechazaFueraDeRangoOConSeparadores(string codigo)
    {
        Assert.False(ValidadorPrestador.EsCodigoValido(codigo),
            $"Esperaba que '{codigo}' fuera inválido");
    }

    // ─── EsNombreValido ─────────────────────────────────────────────────────────

    [Theory]
    [InlineData("Asociación 1")]
    [InlineData("A")]
    [InlineData("Acueducto Regional de San Juan - Sede Principal")]
    public void EsNombreValido_AceptaNoVacioHasta200(string nombre)
    {
        Assert.True(ValidadorPrestador.EsNombreValido(nombre));
    }

    [Theory]
    [InlineData("")]
    public void EsNombreValido_RechazaVacio(string nombre)
    {
        Assert.False(ValidadorPrestador.EsNombreValido(nombre));
    }

    [Fact]
    public void EsNombreValido_RechazaMasDe200Caracteres()
    {
        var nombreLargo = new string('x', 201);
        Assert.False(ValidadorPrestador.EsNombreValido(nombreLargo));
    }

    [Fact]
    public void EsNombreValido_AceptaExactamente200Caracteres()
    {
        var nombreLimite = new string('x', 200);
        Assert.True(ValidadorPrestador.EsNombreValido(nombreLimite));
    }

    // ─── EsNitValido ────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("900123456")]
    [InlineData("900123456-7")]
    [InlineData("X")]
    public void EsNitValido_AceptaNoVacioHasta20(string nit)
    {
        Assert.True(ValidadorPrestador.EsNitValido(nit));
    }

    [Theory]
    [InlineData("")]
    public void EsNitValido_RechazaVacio(string nit)
    {
        Assert.False(ValidadorPrestador.EsNitValido(nit));
    }

    [Fact]
    public void EsNitValido_RechazaMasDe20Caracteres()
    {
        var nitLargo = new string('9', 21);
        Assert.False(ValidadorPrestador.EsNitValido(nitLargo));
    }

    // ─── EsRepresentanteLegalValido ─────────────────────────────────────────────

    [Theory]
    [InlineData("Juan Pérez")]
    [InlineData("M")]
    public void EsRepresentanteLegalValido_AceptaNoVacio(string valor)
    {
        Assert.True(ValidadorPrestador.EsRepresentanteLegalValido(valor));
    }

    [Theory]
    [InlineData("")]
    public void EsRepresentanteLegalValido_RechazaVacio(string valor)
    {
        Assert.False(ValidadorPrestador.EsRepresentanteLegalValido(valor));
    }

    // ─── EsCedulaRepresentanteLegalValida ──────────────────────────────────────

    [Theory]
    [InlineData("123456")]      // 6 dígitos (límite inferior)
    [InlineData("1234567890")]  // 10 dígitos (típico colombiano)
    [InlineData("123456789012")] // 12 dígitos (límite superior)
    public void EsCedulaRepresentanteLegalValida_Acepta6A12Digitos(string cedula)
    {
        Assert.True(ValidadorPrestador.EsCedulaRepresentanteLegalValida(cedula),
            $"Esperaba que '{cedula}' fuera válida");
    }

    [Theory]
    [InlineData("")]
    [InlineData("12345")]           // 5 dígitos
    [InlineData("1234567890123")]   // 13 dígitos
    [InlineData("abc12345")]
    [InlineData("12.345.678")]
    [InlineData("123-456")]
    [InlineData("123 456")]
    public void EsCedulaRepresentanteLegalValida_RechazaInvalidas(string cedula)
    {
        Assert.False(ValidadorPrestador.EsCedulaRepresentanteLegalValida(cedula),
            $"Esperaba que '{cedula}' fuera inválida");
    }

    // ─── EsMunicipioValido / EsDepartamentoValido ───────────────────────────────

    [Theory]
    [InlineData("Bogotá D.C.")]
    [InlineData("M")]
    public void EsMunicipioValido_AceptaNoVacioHasta100(string municipio)
    {
        Assert.True(ValidadorPrestador.EsMunicipioValido(municipio));
    }

    [Theory]
    [InlineData("")]
    public void EsMunicipioValido_RechazaVacio(string municipio)
    {
        Assert.False(ValidadorPrestador.EsMunicipioValido(municipio));
    }

    [Fact]
    public void EsMunicipioValido_RechazaMasDe100Caracteres()
    {
        var municipioLargo = new string('m', 101);
        Assert.False(ValidadorPrestador.EsMunicipioValido(municipioLargo));
    }

    [Theory]
    [InlineData("Cundinamarca")]
    [InlineData("D")]
    public void EsDepartamentoValido_AceptaNoVacioHasta100(string departamento)
    {
        Assert.True(ValidadorPrestador.EsDepartamentoValido(departamento));
    }

    [Theory]
    [InlineData("")]
    public void EsDepartamentoValido_RechazaVacio(string departamento)
    {
        Assert.False(ValidadorPrestador.EsDepartamentoValido(departamento));
    }

    [Fact]
    public void EsDepartamentoValido_RechazaMasDe100Caracteres()
    {
        var departamentoLargo = new string('d', 101);
        Assert.False(ValidadorPrestador.EsDepartamentoValido(departamentoLargo));
    }

    // ─── EsSegmentoValido ───────────────────────────────────────────────────────

    [Theory]
    [InlineData((short)1)]
    [InlineData((short)2)]
    public void EsSegmentoValido_Acepta1O2(short segmento)
    {
        Assert.True(ValidadorPrestador.EsSegmentoValido(segmento));
    }

    [Theory]
    [InlineData((short)0)]
    [InlineData((short)3)]
    [InlineData((short)-1)]
    [InlineData((short)99)]
    public void EsSegmentoValido_RechazaFueraDeRango(short segmento)
    {
        Assert.False(ValidadorPrestador.EsSegmentoValido(segmento));
    }

    // ─── EsNumSuscriptoresUrbanosValido / RuralesValido ────────────────────────

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2500)]
    [InlineData(5000)]
    [InlineData(int.MaxValue)]
    public void EsNumSuscriptoresUrbanosValido_AceptaCeroOMayor(int n)
    {
        Assert.True(ValidadorPrestador.EsNumSuscriptoresUrbanosValido(n));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(-100)]
    [InlineData(int.MinValue)]
    public void EsNumSuscriptoresUrbanosValido_RechazaNegativos(int n)
    {
        Assert.False(ValidadorPrestador.EsNumSuscriptoresUrbanosValido(n));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(100)]
    [InlineData(int.MaxValue)]
    public void EsNumSuscriptoresRuralesValido_AceptaCeroOMayor(int n)
    {
        Assert.True(ValidadorPrestador.EsNumSuscriptoresRuralesValido(n));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(-99)]
    public void EsNumSuscriptoresRuralesValido_RechazaNegativos(int n)
    {
        Assert.False(ValidadorPrestador.EsNumSuscriptoresRuralesValido(n));
    }
}
