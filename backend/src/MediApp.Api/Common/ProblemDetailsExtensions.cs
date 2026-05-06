using Microsoft.AspNetCore.Http;

namespace MediApp.Api.Common;

/// <summary>
/// Helpers para construir respuestas ProblemDetails RFC 7807 consistentes en todos los
/// endpoints de sync. Los URIs <c>type</c> usan el dominio interno mediapp.dev.
/// </summary>
public static class ProblemDetailsExtensions
{
    private const string TypeBase = "https://mediapp.dev/errors";

    public static IResult Conflict409WithHash(string hashServer, string detail)
    {
        var problem = new SyncConflictProblemDetails
        {
            Type = $"{TypeBase}/conflicto-hash",
            Title = "Conflicto de hash al sincronizar",
            Status = StatusCodes.Status409Conflict,
            Detail = detail,
            HashServer = hashServer
        };
        return Results.Json(problem, statusCode: StatusCodes.Status409Conflict, contentType: "application/problem+json");
    }

    public static IResult NotFound404(string detail) =>
        Results.Problem(
            type: $"{TypeBase}/fk-orphan",
            title: "Referencia inexistente",
            detail: detail,
            statusCode: StatusCodes.Status404NotFound);

    public static IResult BadRequest400(string detail, IDictionary<string, string[]>? errors = null)
    {
        if (errors is { Count: > 0 })
        {
            return Results.ValidationProblem(
                errors,
                detail: detail,
                statusCode: StatusCodes.Status400BadRequest,
                title: "Payload inválido",
                type: $"{TypeBase}/validacion");
        }

        return Results.Problem(
            type: $"{TypeBase}/validacion",
            title: "Payload inválido",
            detail: detail,
            statusCode: StatusCodes.Status400BadRequest);
    }
}
