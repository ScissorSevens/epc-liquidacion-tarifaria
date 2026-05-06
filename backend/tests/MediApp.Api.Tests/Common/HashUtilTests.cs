using MediApp.Api.Common;

namespace MediApp.Api.Tests.Common;

/// <summary>
/// Tests del regex IdClienteRegex de HashUtil.
///
/// Decisión arquitectónica (#222): el id_local que viene después del ":" es OPACO para
/// el server. El cliente decide su formato (UUID v4 en mobile, numérico en seed). El
/// server solo requiere que sea único y estable. Por eso aceptamos cualquier
/// alfanumérico/guion bajo/guion, no solo dígitos.
/// </summary>
public class HashUtilTests
{
    [Theory]
    // Casos numéricos clásicos (seed, compatibilidad hacia atrás).
    [InlineData("seed-01:10")]
    [InlineData("tablet-01:42")]
    [InlineData("dev_01:1")]
    // UUID v4 generado por el dominio mobile.
    [InlineData("mobile:12345678-1234-1234-1234-123456789abc")]
    [InlineData("dev_01:f47ac10b-58cc-4372-a567-0e02b2c3d479")]
    // UUID con mayúsculas también es válido (\w incluye [A-Z]).
    [InlineData("mobile:F47AC10B-58CC-4372-A567-0E02B2C3D479")]
    // Mezcla alfanumérica.
    [InlineData("tablet-A:abc-123")]
    public void EsIdClienteValido_AceptaFormatosValidos(string valor)
    {
        Assert.True(HashUtil.EsIdClienteValido(valor),
            $"Esperaba que '{valor}' fuera válido");
    }

    [Theory]
    [InlineData("")]
    [InlineData(":")]
    [InlineData("mobile:")]
    [InlineData(":abc")]
    [InlineData("mobile abc:123")]   // espacio en prefijo
    [InlineData("mobile::123")]      // doble dos puntos
    [InlineData("mobile:hola mundo")] // espacio interno
    [InlineData("sin-dos-puntos")]
    [InlineData("mobile:abc:def")]   // múltiples segmentos
    public void EsIdClienteValido_RechazaFormatosInvalidos(string valor)
    {
        Assert.False(HashUtil.EsIdClienteValido(valor),
            $"Esperaba que '{valor}' fuera inválido");
    }

    [Fact]
    public void EsIdClienteValido_NullEsInvalido()
    {
        Assert.False(HashUtil.EsIdClienteValido(null));
    }
}
