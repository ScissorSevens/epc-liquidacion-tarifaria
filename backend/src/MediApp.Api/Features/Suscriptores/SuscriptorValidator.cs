using System.Text.RegularExpressions;
using FluentValidation;

namespace MediApp.Api.Features.Suscriptores;

public class SuscriptorValidator : AbstractValidator<SuscriptorPayload>
{
    private static readonly string[] EstadosValidos = { "activo", "inactivo", "suspendido" };
    private static readonly Regex CodigoRegex = new(@"^\d{1,10}$", RegexOptions.Compiled);
    private static readonly Regex IdClienteRegex = new(@"^[\w-]+:\d+$", RegexOptions.Compiled);

    public SuscriptorValidator()
    {
        RuleFor(x => x.Codigo)
            .NotEmpty()
            .Must(v => v is not null && CodigoRegex.IsMatch(v))
            .WithMessage("codigo debe tener entre 1 y 10 digitos.");

        RuleFor(x => x.NombreApellidos)
            .NotEmpty().MaximumLength(150);

        RuleFor(x => x.Direccion)
            .NotEmpty().MaximumLength(200);

        RuleFor(x => x.Estrato)
            .InclusiveBetween((short)1, (short)6)
            .WithMessage("Estrato colombiano debe estar entre 1 y 6.");

        RuleFor(x => x.MatriculaInmobiliaria)
            .MaximumLength(50)
            .When(x => x.MatriculaInmobiliaria is not null);

        RuleFor(x => x.NumeroCatastral)
            .MaximumLength(50)
            .When(x => x.NumeroCatastral is not null);

        RuleFor(x => x.Estado)
            .NotEmpty()
            .Must(e => EstadosValidos.Contains(e))
            .WithMessage($"Estado debe ser uno de: {string.Join(", ", EstadosValidos)}.");

        RuleFor(x => x.CreatedAt)
            .NotEmpty().MaximumLength(40);

        RuleFor(x => x.IdCliente)
            .NotEmpty().MaximumLength(120)
            .Must(v => v is not null && IdClienteRegex.IsMatch(v))
            .WithMessage("idCliente debe tener formato `dispositivo:id_local`.");

        // Campos extendidos: validacion CONDICIONAL para retrocompatibilidad con
        // suscriptores legacy sincronizados antes de este change (pueden no tener estos campos).
        RuleFor(x => x.Cedula)
            .MaximumLength(20)
            .When(x => x.Cedula is not null);

        RuleFor(x => x.Municipio)
            .MaximumLength(100)
            .When(x => x.Municipio is not null);

        RuleFor(x => x.Sector)
            .MaximumLength(100)
            .When(x => x.Sector is not null);

        // AplicaSubsidio es bool? — no necesita regla de longitud ni formato.
    }
}
