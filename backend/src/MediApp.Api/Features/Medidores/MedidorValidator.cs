using System.Text.RegularExpressions;
using FluentValidation;

namespace MediApp.Api.Features.Medidores;

public class MedidorValidator : AbstractValidator<MedidorPayload>
{
    private static readonly string[] EstadosValidos = { "activo", "inactivo", "reemplazado" };
    private static readonly Regex NumeroMedidorRegex = new(@"^[A-Za-z0-9-]{1,50}$", RegexOptions.Compiled);
    private static readonly Regex IdClienteRegex = new(@"^[\w-]+:\d+$", RegexOptions.Compiled);
    private static readonly Regex FechaIsoDateRegex = new(@"^\d{4}-\d{2}-\d{2}$", RegexOptions.Compiled);

    public MedidorValidator()
    {
        RuleFor(x => x.NumeroMedidor)
            .NotEmpty()
            .Must(v => v is not null && NumeroMedidorRegex.IsMatch(v))
            .WithMessage("numero_medidor solo admite letras, digitos y guiones (1-50 caracteres).");

        RuleFor(x => x.IdSuscriptorCliente)
            .NotEmpty()
            .Must(v => v is not null && IdClienteRegex.IsMatch(v))
            .WithMessage("idSuscriptorCliente debe tener formato `dispositivo:id_local`.");

        RuleFor(x => x.FechaInstalacion)
            .NotEmpty()
            .Must(v => v is not null && FechaIsoDateRegex.IsMatch(v))
            .WithMessage("fecha_instalacion debe ser ISO 8601 (YYYY-MM-DD).");

        RuleFor(x => x.Estado)
            .NotEmpty()
            .Must(e => EstadosValidos.Contains(e))
            .WithMessage($"Estado debe ser uno de: {string.Join(", ", EstadosValidos)}.");

        RuleFor(x => x.Observaciones)
            .MaximumLength(500)
            .When(x => x.Observaciones is not null);

        RuleFor(x => x.IdCliente)
            .NotEmpty().MaximumLength(120)
            .Must(v => v is not null && IdClienteRegex.IsMatch(v))
            .WithMessage("idCliente debe tener formato `dispositivo:id_local`.");
    }
}
