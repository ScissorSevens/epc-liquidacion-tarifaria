using System.Globalization;
using MediApp.Api.Dominio.Entidades;
using MediApp.Api.Dominio.Puertos;

namespace MediApp.Api.API.Features.Prestadores;

/// <summary>
/// Importador CSV de Prestadores (multipart/form-data).
///
/// Formato CSV esperado (con encabezado):
///   codigo,nombre,nit,municipio,departamento,segmento,num_suscriptores_urbanos,num_suscriptores_rurales,contacto
///
/// Donde:
///   - segmento: 1 o 2 (Res CRA 825/2017 art. 6)
///   - num_* : enteros >= 0
///   - contacto : opcional (puede ser vacio)
///
/// Devuelve resumen: { total, creados, errores, detalle_errores[] }
/// </summary>
public static class ImportarPrestadoresEndpoints
{
    public sealed class ImportarResultadoDto
    {
        public int Total { get; set; }
        public int Creados { get; set; }
        public int Errores { get; set; }
        public List<ErrorFilaDto> DetalleErrores { get; set; } = new();
    }

    public sealed class ErrorFilaDto
    {
        public int Fila { get; set; }
        public string Codigo { get; set; } = string.Empty;
        public string Mensaje { get; set; } = string.Empty;
    }

    public static RouteGroupBuilder MapImportarPrestadoresEndpoints(this RouteGroupBuilder grupo)
    {
        // POST /api/v1/prestadores/importar-csv (multipart/form-data, campo "archivo")
        grupo.MapPost("/importar-csv", async (
            HttpRequest req,
            IRepositorioPrestador repo,
            ILoggerFactory loggerFactory,
            CancellationToken ct) =>
        {
            var logger = loggerFactory.CreateLogger("ImportarPrestadores");
            if (!req.HasFormContentType)
            {
                return Results.BadRequest(new { error = "Se requiere Content-Type multipart/form-data" });
            }

            var form = await req.ReadFormAsync(ct);
            var archivo = form.Files["archivo"];
            if (archivo is null || archivo.Length == 0)
            {
                return Results.BadRequest(new { error = "Falta el campo 'archivo' en el form-data" });
            }

            var resultado = new ImportarResultadoDto();
            using var reader = new StreamReader(archivo.OpenReadStream());
            string? linea;
            int numLinea = 0;
            bool primera = true;

            while ((linea = await reader.ReadLineAsync(ct)) is not null)
            {
                numLinea++;
                if (primera)
                {
                    primera = false;
                    // Detectar header (la primera columna es "codigo")
                    if (linea.TrimStart().StartsWith("codigo", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }
                }
                if (string.IsNullOrWhiteSpace(linea))
                {
                    continue;
                }
                resultado.Total++;

                var campos = linea.Split(',');
                if (campos.Length < 6)
                {
                    resultado.Errores++;
                    resultado.DetalleErrores.Add(new ErrorFilaDto
                    {
                        Fila = numLinea,
                        Codigo = campos.Length > 0 ? campos[0] : string.Empty,
                        Mensaje = "fila con menos de 6 columnas (codigo, nombre, nit, municipio, departamento, segmento)",
                    });
                    continue;
                }

                try
                {
                    var prestador = new Prestador
                    {
                        Codigo = campos[0].Trim(),
                        Nombre = campos[1].Trim(),
                        Nit = campos[2].Trim(),
                        Municipio = campos[3].Trim(),
                        Departamento = campos[4].Trim(),
                        Segmento = short.Parse(campos[5].Trim(), CultureInfo.InvariantCulture),
                        NumSuscriptoresUrbanos = campos.Length > 6 && !string.IsNullOrWhiteSpace(campos[6])
                            ? int.Parse(campos[6].Trim(), CultureInfo.InvariantCulture)
                            : 0,
                        NumSuscriptoresRurales = campos.Length > 7 && !string.IsNullOrWhiteSpace(campos[7])
                            ? int.Parse(campos[7].Trim(), CultureInfo.InvariantCulture)
                            : 0,
                        Contacto = campos.Length > 8 ? campos[8].Trim() : null,
                        Estado = "activo",
                    };

                    if (prestador.Segmento is not (1 or 2))
                    {
                        throw new FormatException("segmento debe ser 1 o 2");
                    }

                    var existe = await repo.ExistePorCodigoAsync(prestador.Codigo, ct);
                    if (existe)
                    {
                        resultado.Errores++;
                        resultado.DetalleErrores.Add(new ErrorFilaDto
                        {
                            Fila = numLinea,
                            Codigo = prestador.Codigo,
                            Mensaje = "ya existe un prestador con ese codigo",
                        });
                        continue;
                    }

                    await repo.CrearAsync(prestador, ct);
                    resultado.Creados++;
                }
                catch (Exception ex) when (ex is FormatException or InvalidOperationException)
                {
                    resultado.Errores++;
                    resultado.DetalleErrores.Add(new ErrorFilaDto
                    {
                        Fila = numLinea,
                        Codigo = campos.Length > 0 ? campos[0] : string.Empty,
                        Mensaje = ex.Message,
                    });
                }
            }

            logger.LogInformation(
                "Importar prestadores CSV: total={Total} creados={Creados} errores={Errores}",
                resultado.Total, resultado.Creados, resultado.Errores);

            return Results.Ok(resultado);
        });

        return grupo;
    }
}
