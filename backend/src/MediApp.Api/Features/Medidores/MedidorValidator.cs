using System.Text.RegularExpressions;
using FluentValidation;

namespace MediApp.Api.Features.Medidores;

public class MedidorValidator : AbstractValidator<MedidorPayload>
{
    private static readonly string[] EstadosValidos = { "activo", "inactivo", "retirado" };
    private static readonly Regex IdClienteRegex = new(@"^[\w-]+:\d+$", RegexOptions.Compiled);

    public MedidorValidator()
    {
        RuleFor(x => x.Codigo)
            .NotEmpty().MaximumLength(80);

        RuleFor(x => x.IdSuscriptorCliente)
            .NotEmpty()
            .Must(v => IdClienteRegex.IsMatch(v))
            .WithMessage("idSuscriptorCliente debe tener formato `dispositivo:id_local`.");

        RuleFor(x => x.Estado)
            .NotEmpty()
            .Must(e => EstadosValidos.Contains(e))
            .WithMessage($"Estado debe ser uno de: {string.Join(", ", EstadosValidos)}.");

        RuleFor(x => x.IdCliente)
            .NotEmpty().MaximumLength(120);
    }
}
