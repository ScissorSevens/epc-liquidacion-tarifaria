namespace MediApp.Api.Infrastructure.Almacen;

/// <summary>
/// Abstracción para persistir evidencias fotográficas (jpeg/png) que vienen embebidas
/// en base64 dentro del payload de Lectura. La impl por defecto guarda en filesystem
/// local; en producción se puede swapear por una que escriba a Azure Blob u S3.
/// </summary>
public interface IAlmacenEvidencias
{
    /// <summary>
    /// Persiste los bytes y devuelve la ruta relativa a guardar en
    /// <c>lecturas.evidencia_foto_ruta</c>.
    /// </summary>
    /// <param name="idCliente">idCliente de la Lectura (formato `dispositivo:id_local`); se usa como nombre base del archivo.</param>
    /// <param name="base64">Contenido del archivo en base64 puro (sin prefijo data:...).</param>
    /// <param name="mime">MIME type del archivo (ej. "image/jpeg"). Determina la extensión.</param>
    Task<string> GuardarAsync(string idCliente, string base64, string mime, CancellationToken ct);
}
