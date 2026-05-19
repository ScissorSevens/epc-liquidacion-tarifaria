using MediApp.Api.Dominio.Entidades;

namespace MediApp.Api.Features.Liquidaciones;

/// <summary>Mapeos payload mobile ↔ entidad EF para Liquidación.</summary>
public static class LiquidacionMapper
{
    /// <param name="idLectura">Id server de la Lectura ya resuelto por el endpoint.</param>
    public static Liquidacion PayloadAEntidad(LiquidacionPayload p, int idLectura) => new()
    {
        IdLectura = idLectura,
        ConsumoM3 = p.ConsumoM3,
        CargoFijo = p.CargoFijo,
        CargoBasico = p.CargoBasico,
        CargoExcedente = p.CargoExcedente,
        Subsidio = p.Subsidio,
        Contribucion = p.Contribucion,
        Total = p.Total,
        Estrato = p.Estrato,
        IdCliente = p.IdCliente
    };

    public static void AplicarPayload(LiquidacionPayload p, Liquidacion entidad, int idLectura)
    {
        entidad.IdLectura = idLectura;
        entidad.ConsumoM3 = p.ConsumoM3;
        entidad.CargoFijo = p.CargoFijo;
        entidad.CargoBasico = p.CargoBasico;
        entidad.CargoExcedente = p.CargoExcedente;
        entidad.Subsidio = p.Subsidio;
        entidad.Contribucion = p.Contribucion;
        entidad.Total = p.Total;
        entidad.Estrato = p.Estrato;
        // IdCliente NO se cambia: identidad lógica.
    }
}
