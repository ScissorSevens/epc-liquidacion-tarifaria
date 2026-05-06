using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;

namespace MediApp.Api.Common;

/// <summary>
/// Sobre genérico que el mobile postea para sincronizar un item. Espejo del
/// <c>ItemCola</c> del cliente HTTP del mobile (protocolo #213).
/// </summary>
/// <typeparam name="TPayload">Tipo del payload de negocio (suscriptor, medidor, lectura, liquidacion).</typeparam>
public class SyncRequest<TPayload>
{
    /// <summary>UUID local generado en el mobile (no se persiste como PK).</summary>
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    /// <summary>"suscriptor" | "medidor" | "lectura" | "liquidacion".</summary>
    [JsonPropertyName("tipo")]
    public string Tipo { get; set; } = string.Empty;

    /// <summary>Payload de negocio.</summary>
    [JsonPropertyName("payload")]
    public TPayload Payload { get; set; } = default!;

    /// <summary>SHA-256 hex (64 chars) calculado por el mobile sobre el payload normalizado.</summary>
    [JsonPropertyName("hashLocal")]
    public string HashLocal { get; set; } = string.Empty;

    /// <summary>Si <c>true</c> y hay conflicto, el server sobrescribe en lugar de devolver 409.</summary>
    [JsonPropertyName("forzarSobrescribir")]
    public bool ForzarSobrescribir { get; set; }

    /// <summary>Identidad lógica offline. Formato `dispositivo:id_local` (ej. "tablet-01:42").</summary>
    [JsonPropertyName("idCliente")]
    public string IdCliente { get; set; } = string.Empty;

    /// <summary>Cantidad de intentos previos del cliente. Telemetría, no usado por el handler.</summary>
    [JsonPropertyName("intentos")]
    public int Intentos { get; set; }

    /// <summary>Timestamp del último intento del cliente. Telemetría.</summary>
    [JsonPropertyName("ultimoIntento")]
    public DateTimeOffset? UltimoIntento { get; set; }
}

/// <summary>
/// Respuesta de éxito (201 nuevo, 200 idempotente, 200 sobrescritura).
/// </summary>
public record SyncResponse(
    [property: JsonPropertyName("idServer")] int IdServer,
    [property: JsonPropertyName("hashServer")] string HashServer);

/// <summary>
/// ProblemDetails extendido con <c>hashServer</c> para el caso 409 (conflicto de hash).
/// El cliente lo usa para decidir entre reintentar con <c>forzarSobrescribir=true</c> o
/// resolver manualmente.
/// </summary>
public class SyncConflictProblemDetails : ProblemDetails
{
    [JsonPropertyName("hashServer")]
    public string HashServer { get; set; } = string.Empty;
}
