namespace MediApp.Api.Infrastructure.Almacen;

/// <summary>
/// Impl por defecto del almacén de evidencias: escribe a filesystem local en
/// la ruta configurada en <c>Almacen:RutaLocal</c> (default <c>./evidencias</c>).
/// Sanitiza el idCliente (reemplaza separadores) y mapea MIME a extensión.
/// </summary>
public class AlmacenLocal : IAlmacenEvidencias
{
    private readonly string _rutaLocal;
    private readonly ILogger<AlmacenLocal> _logger;

    public AlmacenLocal(IConfiguration configuration, ILogger<AlmacenLocal> logger)
    {
        _rutaLocal = configuration["Almacen:RutaLocal"] ?? "./evidencias";
        _logger = logger;
    }

    public Task<string> GuardarAsync(string idCliente, string base64, string mime, CancellationToken ct)
    {
        // Sanitizar para evitar separadores de path en el nombre de archivo.
        var idClienteSano = idCliente.Replace(':', '_').Replace('/', '_').Replace('\\', '_');

        var ext = MimeAExtension(mime);

        try
        {
            Directory.CreateDirectory(_rutaLocal);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "No se pudo crear directorio de evidencias '{Ruta}'.", _rutaLocal);
            throw new IOException($"No se pudo crear directorio de evidencias '{_rutaLocal}'.", ex);
        }

        byte[] bytes;
        try
        {
            bytes = Convert.FromBase64String(base64);
        }
        catch (FormatException ex)
        {
            throw new ArgumentException("base64 inválido en evidencia foto.", nameof(base64), ex);
        }

        var rutaArchivo = Path.Combine(_rutaLocal, $"{idClienteSano}{ext}");

        try
        {
            File.WriteAllBytes(rutaArchivo, bytes);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            _logger.LogError(ex, "Error escribiendo evidencia '{Ruta}'.", rutaArchivo);
            throw new IOException($"Error escribiendo evidencia '{rutaArchivo}'.", ex);
        }

        // Devolvemos ruta relativa (cómo se guarda en DB).
        return Task.FromResult(rutaArchivo);
    }

    private string MimeAExtension(string mime)
    {
        return mime?.ToLowerInvariant() switch
        {
            "image/jpeg" or "image/jpg" => ".jpg",
            "image/png" => ".png",
            _ => LoguearYDevolverDefault(mime)
        };
    }

    private string LoguearYDevolverDefault(string? mime)
    {
        _logger.LogWarning("MIME '{Mime}' desconocido al guardar evidencia; usando extensión .bin.", mime ?? "(null)");
        return ".bin";
    }
}
