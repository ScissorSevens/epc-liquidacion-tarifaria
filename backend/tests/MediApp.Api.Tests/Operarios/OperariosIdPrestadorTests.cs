using System.Reflection;
using System.Text.Json.Serialization;
using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Features.Operarios;

namespace MediApp.Api.Tests.Operarios;

/// <summary>
/// Tests conceptuales (sin DB) que verifican que la entidad Operario,
/// el payload JSON y el mapper soportan el campo IdPrestador
/// (FK a prestadores, no null, default 0).
///
/// Espejo de los cambios que ya se hicieron en el repositorio mobile
/// (types/operario.ts) durante la fase 3.2. Garantiza compatibilidad
/// con la migration EF Core AgregarIdPrestadorOperario.
///
/// NOTA: id_prestador = 0 está reservado para el prestador legacy
/// "EPC-LEGACY" (id_prestador=0) que mantiene compatibilidad con
/// datos preexistentes. La FK con ON DELETE RESTRICT protege
/// contra eliminación accidental de prestadores con operarios.
/// </summary>
public class OperariosIdPrestadorTests
{
    // ─── T-3.4-1: Operario nuevo tiene IdPrestador = 0 (default) ─────────────

    [Fact]
    public void Operario_Nuevo_TieneIdPrestadorDefaultCero()
    {
        var o = new Operario();

        Assert.Equal(0, o.IdPrestador);
    }

    // ─── T-3.4-2: Asignar y leer IdPrestador (round-trip) ────────────────────

    [Fact]
    public void Operario_AsignarYObtenerIdPrestador_RoundTrip()
    {
        var o = new Operario
        {
            NumeroCedula = "123456",
            Nombre = "Test",
            Email = "t@t.com",
            PasswordHash = "$2b$10$xxx",
            IdPrestador = 7
        };

        Assert.Equal(7, o.IdPrestador);
    }

    // ─── T-3.4-3: Sobreescritura de IdPrestador (re-asignación) ──────────────

    [Fact]
    public void Operario_SobreescribirIdPrestador_DistintosValores_SonIndependientes()
    {
        var o = new Operario { IdPrestador = 1 };
        o.IdPrestador = 42;

        Assert.Equal(42, o.IdPrestador);
    }

    // ─── T-3.4-4: Payload expone IdPrestador en JSON snake_case ──────────────

    [Fact]
    public void OperarioPayload_ExponeIdPrestadorEnJson_ConNombreSnakeCase()
    {
        // Default del payload debe coincidir con la entidad (= 0)
        var payload = new OperarioPayload();
        Assert.Equal(0, payload.IdPrestador);

        // Verificación via reflection: la propiedad DEBE tener
        // JsonPropertyNameAttribute con el nombre snake_case esperado
        // para que el JSON intercambiado con mobile/admin conserve el contrato.
        var prop = typeof(OperarioPayload).GetProperty(
            "IdPrestador",
            BindingFlags.Public | BindingFlags.Instance);
        Assert.NotNull(prop);

        var attrs = prop.GetCustomAttributes(typeof(JsonPropertyNameAttribute), inherit: false);
        Assert.NotEmpty(attrs);

        var attr = (JsonPropertyNameAttribute)attrs[0];
        Assert.Equal("id_prestador", attr.Name);
    }

    // ─── T-3.4-5: OperarioMapper.PayloadAEntidad copia IdPrestador ───────────

    [Fact]
    public void Mapper_PayloadAEntidad_CopiaIdPrestador()
    {
        var payload = new OperarioPayload
        {
            NumeroCedula = "123456",
            Nombre = "Test",
            Email = "t@t.com",
            PasswordHash = "$2b$10$xxx",
            Rol = "operario",
            Estado = "activo",
            CreatedAt = "2026-07-10T00:00:00Z",
            IdPrestador = 9
        };

        var entidad = OperarioMapper.PayloadAEntidad(payload);

        Assert.Equal(9, entidad.IdPrestador);
    }

    // ─── T-4.6: OperarioMapper.AplicarPayload sobreescribe IdPrestador ───────
    // (esta prueba valida que el update path también soporta el nuevo campo)

    [Fact]
    public void Mapper_AplicarPayload_SobreescribeIdPrestador()
    {
        var entidad = new Operario
        {
            IdPrestador = 1   // valor viejo que el update debe poder reemplazar
        };

        var payload = new OperarioUpdatePayload
        {
            IdPrestador = 5
        };

        OperarioMapper.AplicarPayload(payload, entidad);

        Assert.Equal(5, entidad.IdPrestador);
    }

    // ─── T-3.4-7: Navigation property Prestador existe y es opcional ─────────

    [Fact]
    public void Operario_TieneNavigationPropertyPrestador_Opcional()
    {
        // La navigation property es opcional (nullable) — debe poder
        // ser null cuando el operario se carga sin eager-loading de Prestador.
        var o = new Operario();

        Assert.Null(o.Prestador);
    }

    // ─── T-3.4-8: Asignar y leer la navigation property (round-trip) ──────────

    [Fact]
    public void Operario_AsignarYObtenerPrestador_Navigation_RoundTrip()
    {
        var prestador = new Prestador
        {
            IdPrestador = 3,
            Codigo = "ASOC-3",
            Nombre = "Test Prestador",
            Nit = "900",
            Municipio = "Bogotá",
            Departamento = "Cundinamarca",
            Segmento = 1
        };

        var o = new Operario { Prestador = prestador };

        Assert.NotNull(o.Prestador);
        Assert.Equal(3, o.Prestador!.IdPrestador);
        Assert.Equal("ASOC-3", o.Prestador.Codigo);
    }
}
