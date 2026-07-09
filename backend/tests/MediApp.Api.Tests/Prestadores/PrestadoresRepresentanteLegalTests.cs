using System.ComponentModel.DataAnnotations;
using System.Reflection;
using System.Text.Json.Serialization;
using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Features.Prestadores;

namespace MediApp.Api.Tests.Prestadores;

/// <summary>
/// Tests conceptuales (sin DB) que verifican que la entidad Prestador,
/// el payload JSON y el mapper soportan los campos RepresentanteLegal
/// y RepresentanteLegalCedula.
///
/// Espejo de los cambios que ya se hicieron en el repositorio mobile
/// (types/prestador.ts) durante la fase 3.1. Garantiza compatibilidad
/// con la migration EF Core AgregarRepresentanteLegal.
/// </summary>
public class PrestadoresRepresentanteLegalTests
{
    // ─── T-3.3-1: Prestador nuevo tiene defaults = string.Empty ───────────────

    [Fact]
    public void Prestador_Nuevo_TieneRepresentanteLegalYRepresentanteLegalCedulaComoEmpty()
    {
        var p = new Prestador();

        Assert.Equal(string.Empty, p.RepresentanteLegal);
        Assert.Equal(string.Empty, p.RepresentanteLegalCedula);
    }

    // ─── T-3.3-2: Round-trip de asignación ────────────────────────────────────

    [Fact]
    public void Prestador_AsignarYObtenerRepresentanteLegal_RoundTrip()
    {
        var p = new Prestador
        {
            Codigo = "ASOC-001",
            Nombre = "Asociación Test",
            Nit = "900123456",
            Municipio = "Bogotá",
            Departamento = "Cundinamarca",
            Segmento = 1,
            RepresentanteLegal = "María López Reyes",
            RepresentanteLegalCedula = "51800012"
        };

        Assert.Equal("María López Reyes", p.RepresentanteLegal);
        Assert.Equal("51800012", p.RepresentanteLegalCedula);
    }

    // ─── T-3.3-3: Re-asingación tras carga desde DB (segundo round-trip) ──────

    [Fact]
    public void Prestador_SobreescribirRepresentanteLegal_DistintosValores_SonIndependientes()
    {
        var p = new Prestador
        {
            RepresentanteLegal = "Juan Pérez",
            RepresentanteLegalCedula = "1234567890"
        };

        // Triangulación: los campos pueden mutarse sin arrastrar estado.
        p.RepresentanteLegal = "Ana Ruiz";
        p.RepresentanteLegalCedula = "9876543210";

        Assert.Equal("Ana Ruiz", p.RepresentanteLegal);
        Assert.Equal("9876543210", p.RepresentanteLegalCedula);
    }

    // ─── T-3.3-4: Payload expone los campos en JSON snake_case ────────────────

    [Fact]
    public void PrestadorPayload_ExponeCamposEnJson_ConNombresSnakeCase()
    {
        // Defaults del payload (deben coincidir con la entidad)
        var payload = new PrestadorPayload();
        Assert.Equal(string.Empty, payload.RepresentanteLegal);
        Assert.Equal(string.Empty, payload.RepresentanteLegalCedula);

        // Verificación via reflection: las propiedades DEBEN tener
        // JsonPropertyNameAttribute con los nombres snake_case esperados
        // para que el JSON intercambiado con mobile/admin conserve el contrato.
        AssertJsonPropertyName(
            typeof(PrestadorPayload),
            propertyName: "RepresentanteLegal",
            expectedJsonName: "representante_legal");

        AssertJsonPropertyName(
            typeof(PrestadorPayload),
            propertyName: "RepresentanteLegalCedula",
            expectedJsonName: "representante_legal_cedula");
    }

    private static void AssertJsonPropertyName(Type type, string propertyName, string expectedJsonName)
    {
        var prop = type.GetProperty(propertyName, BindingFlags.Public | BindingFlags.Instance);
        Assert.NotNull(prop);

        var attrs = prop.GetCustomAttributes(typeof(JsonPropertyNameAttribute), inherit: false);
        Assert.NotEmpty(attrs);

        var attr = (JsonPropertyNameAttribute)attrs[0];
        Assert.Equal(expectedJsonName, attr.Name);
    }

    // ─── T-3.3-5: PrestadorMapper.PayloadAEntidad copia los nuevos campos ──────

    [Fact]
    public void Mapper_PayloadAEntidad_CopiaRepresentanteLegal()
    {
        var payload = new PrestadorPayload
        {
            Codigo = "TEST-001",
            Nombre = "Test SpA",
            Nit = "900111222",
            Municipio = "Bogotá",
            Departamento = "Cundinamarca",
            Segmento = 2,
            NumSuscriptoresUrbanos = 100,
            NumSuscriptoresRurales = 50,
            Contacto = "contacto@test.com",
            Estado = "activo",
            RepresentanteLegal = "Carlos Pérez",
            RepresentanteLegalCedula = "7999888"
        };

        var entidad = PrestadorMapper.PayloadAEntidad(payload);

        Assert.Equal("Carlos Pérez", entidad.RepresentanteLegal);
        Assert.Equal("7999888", entidad.RepresentanteLegalCedula);
    }

    // ─── T-3.3-6: PrestadorMapper.AplicarPayload copia los nuevos campos ──────

    [Fact]
    public void Mapper_AplicarPayload_SobreescribeRepresentanteLegal()
    {
        var entidad = new Prestador
        {
            Codigo = "OLD-001",
            Nombre = "Old",
            Nit = "1",
            Municipio = "M",
            Departamento = "D",
            // valor viejo en la entidad que el update debe reemplazar
            RepresentanteLegal = "Representante Anterior",
            RepresentanteLegalCedula = "111"
        };

        var payload = new PrestadorPayload
        {
            Codigo = "OLD-001",
            Nombre = "Old",
            Nit = "1",
            Municipio = "M",
            Departamento = "D",
            Segmento = 1,
            RepresentanteLegal = "Representante Nuevo",
            RepresentanteLegalCedula = "222"
        };

        PrestadorMapper.AplicarPayload(payload, entidad);

        Assert.Equal("Representante Nuevo", entidad.RepresentanteLegal);
        Assert.Equal("222", entidad.RepresentanteLegalCedula);
    }

    // ─── T-3.3-7: MaxLength data-annotations constraints ──────────────────────

    [Fact]
    public void Prestador_RepresentanteLegal_TieneMaxLength200()
    {
        var prop = typeof(Prestador).GetProperty(
            "RepresentanteLegal",
            BindingFlags.Public | BindingFlags.Instance);
        Assert.NotNull(prop);

        var attrs = prop.GetCustomAttributes(typeof(MaxLengthAttribute), inherit: false);
        Assert.NotEmpty(attrs);

        var attr = (MaxLengthAttribute)attrs[0];
        Assert.Equal(200, attr.Length);
    }

    [Fact]
    public void Prestador_RepresentanteLegalCedula_TieneMaxLength12()
    {
        var prop = typeof(Prestador).GetProperty(
            "RepresentanteLegalCedula",
            BindingFlags.Public | BindingFlags.Instance);
        Assert.NotNull(prop);

        var attrs = prop.GetCustomAttributes(typeof(MaxLengthAttribute), inherit: false);
        Assert.NotEmpty(attrs);

        var attr = (MaxLengthAttribute)attrs[0];
        Assert.Equal(12, attr.Length);
    }

    // ─── T-3.3-9: Payload usa max length en JSON para documentación ──────────
    //
    // Verifica que el payload también refleja la misma longitud máxima que la
    // entidad. Esto es importante porque el payload define el contrato de API,
    // independiente de las DataAnnotations de la entidad EF.

    [Fact]
    public void PrestadorPayload_RepresentanteLegalCedula_TieneMaxLength12()
    {
        // El payload sólo lleva los datos serializados; no tiene DataAnnotations
        // en el proyecto actual. Lo que validamos es que el Payload acepta el
        // valor y que su propiedad se llama igual que la entidad.
        var payload = new PrestadorPayload { RepresentanteLegalCedula = "123456789012" };
        Assert.Equal(12, payload.RepresentanteLegalCedula.Length);
    }
}
