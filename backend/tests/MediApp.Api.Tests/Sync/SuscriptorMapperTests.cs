using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Features.Suscriptores;

namespace MediApp.Api.Tests.Sync;

public class SuscriptorMapperTests
{
    [Fact]
    public void PayloadAEntidad_MapeaEmailYTelefonoOpcionales()
    {
        var entidad = SuscriptorMapper.PayloadAEntidad(new SuscriptorPayload
        {
            Email = "cliente@example.com",
            Telefono = "3001234567",
        });

        Assert.Equal("cliente@example.com", entidad.Email);
        Assert.Equal("3001234567", entidad.Telefono);
    }

    [Fact]
    public void AplicarPayload_ActualizaContactosCuandoSeProveen()
    {
        var entidad = new Suscriptor
        {
            Email = "anterior@example.com",
            Telefono = "3000000000",
        };

        SuscriptorMapper.AplicarPayload(new SuscriptorPayload
        {
            Email = "nuevo@example.com",
            Telefono = "3101234567",
        }, entidad);

        Assert.Equal("nuevo@example.com", entidad.Email);
        Assert.Equal("3101234567", entidad.Telefono);
    }
}
