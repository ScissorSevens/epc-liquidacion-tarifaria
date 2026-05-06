using FluentValidation;

namespace MediApp.Api.Features.Suscriptores;

public class SuscriptorValidator : AbstractValidator<SuscriptorPayload>
{
    private static readonly string[] EstadosValidos = { "activo", "inactivo", "suspendido" };

    public SuscriptorValidator()
    {
        RuleFor(x => x.Documento)
            .NotEmpty().MaximumLength(50);

        RuleFor(x => x.Nombre)
            .NotEmpty().MaximumLength(150);

        RuleFor(x => x.Direccion)
            .MaximumLength(200);

        RuleFor(x => x.Estrato)
            .InclusiveBetween((short)1, (short)6)
            .WithMessage("Estrato colombiano debe estar entre 1 y 6.");

        RuleFor(x => x.Estado)
            .NotEmpty()
            .Must(e => EstadosValidos.Contains(e))
            .WithMessage($"Estado debe ser uno de: {string.Join(", ", EstadosValidos)}.");

        RuleFor(x => x.IdCliente)
            .NotEmpty().MaximumLength(120);
    }
}
