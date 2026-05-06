using MediApp.Api.Persistence.Entities;

namespace MediApp.Api.Features.Lecturas;

/// <summary>Mapeos payload mobile ↔ entidad EF para Lectura.</summary>
public static class LecturaMapper
{
    /// <param name="idMedidor">Id server del Medidor ya resuelto por el endpoint.</param>
    public static Lectura PayloadAEntidad(LecturaPayload p, int idMedidor) => new()
    {
        IdMedidor = idMedidor,
        LecturaActual = p.LecturaActual,
        LecturaAnterior = p.LecturaAnterior,
        Periodo = p.Periodo,
        IdOperario = p.IdOperario,
        TimestampCaptura = p.TimestampCaptura,
        Observaciones = p.Observaciones,
        EvidenciaFotoRuta = p.EvidenciaFotoRutaResuelta,
        EvidenciaFotoHash = p.EvidenciaFotoHash,
        IdCliente = p.IdCliente
    };

    /// <summary>Aplica el payload a una entidad ya persistida (caso sobrescritura).</summary>
    public static void AplicarPayload(LecturaPayload p, Lectura entidad, int idMedidor)
    {
        entidad.IdMedidor = idMedidor;
        entidad.LecturaActual = p.LecturaActual;
        entidad.LecturaAnterior = p.LecturaAnterior;
        entidad.Periodo = p.Periodo;
        entidad.IdOperario = p.IdOperario;
        entidad.TimestampCaptura = p.TimestampCaptura;
        entidad.Observaciones = p.Observaciones;
        // Si el preProcess resolvió ruta nueva, la pisamos. Si no (foto no cambió), mantenemos.
        if (p.EvidenciaFotoRutaResuelta is not null)
        {
            entidad.EvidenciaFotoRuta = p.EvidenciaFotoRutaResuelta;
        }
        entidad.EvidenciaFotoHash = p.EvidenciaFotoHash;
        // IdCliente NO se cambia: identidad lógica.
    }
}
