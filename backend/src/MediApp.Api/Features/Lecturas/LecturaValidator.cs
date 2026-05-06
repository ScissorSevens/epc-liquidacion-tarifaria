using System.Text.RegularExpressions;
using FluentValidation;
using MediApp.Api.Common;

namespace MediApp.Api.Features.Lecturas;

public class LecturaValidator : AbstractValidator<LecturaPayload>
{
    private static readonly Regex IdClienteRegex = new(@"^[\w-]+:\d+$", RegexOptions.Compiled);
    private static readonly Regex PeriodoRegex = new(@"^\d{6}$", RegexOptions.Compiled);

    public LecturaValidator()
    {
        RuleFor(x => x.IdMedidorCliente)
            .NotEmpty()
            .Must(v => IdClienteRegex.IsMatch(v))
            .WithMessage("idMedidorCliente debe tener formato `dispositivo:id_local`.");

        RuleFor(x => x.Periodo)
            .NotEmpty()
            .Must(v => PeriodoRegex.IsMatch(v))
            .WithMessage("Periodo debe ser exactamente 6 dígitos formato YYYYMM.");

        RuleFor(x => x.LecturaActual)
            .GreaterThanOrEqualTo(x => x.LecturaAnterior)
            .WithMessage("lecturaActual debe ser >= lecturaAnterior (los medidores no retroceden).");

        RuleFor(x => x.IdOperario)
            .GreaterThan(0);

        RuleFor(x => x.Observaciones)
            .MaximumLength(500);

        RuleFor(x => x.EvidenciaFotoHash)
            .Must(v => v is null || HashUtil.EsSha256HexValido(v))
            .WithMessage("evidenciaFotoHash debe ser SHA-256 hex de 64 caracteres en minúsculas (o omitirse).");

        // Si vino base64, también debe venir el MIME (necesario para mapear extensión).
        RuleFor(x => x.EvidenciaFotoMime)
            .NotEmpty()
            .When(x => !string.IsNullOrEmpty(x.EvidenciaFotoBase64))
            .WithMessage("evidenciaFotoMime es requerido cuando hay evidenciaFotoBase64.");

        RuleFor(x => x.IdCliente)
            .NotEmpty().MaximumLength(120);
    }
}
