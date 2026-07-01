using System.Text.RegularExpressions;
using FluentValidation;

namespace MediApp.Api.Features.Liquidaciones;

public class LiquidacionValidator : AbstractValidator<LiquidacionPayload>
{
    private static readonly Regex IdClienteRegex = new(@"^[\w-]+:\d+$", RegexOptions.Compiled);

    public LiquidacionValidator()
    {
        RuleFor(x => x.IdLecturaCliente)
            .NotEmpty()
            .Must(v => IdClienteRegex.IsMatch(v))
            .WithMessage("idLecturaCliente debe tener formato `dispositivo:id_local`.");

        RuleFor(x => x.Estrato)
            .InclusiveBetween((short)1, (short)6)
            .WithMessage("Estrato colombiano debe estar entre 1 y 6.");

        RuleFor(x => x.ConsumoM3).GreaterThanOrEqualTo(0);
        RuleFor(x => x.CargoFijo).GreaterThanOrEqualTo(0);
        RuleFor(x => x.CargoBasico).GreaterThanOrEqualTo(0);
        RuleFor(x => x.CargoExcedente).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Subsidio).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Contribucion).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Total).GreaterThanOrEqualTo(0);

        // Multi-tenant: id_prestador >= 0 (0 = EPC-LEGACY backward compat).
        // Si la nueva versión del mobile lo envia (> 0), el endpoint
        // resuelve contra AcuerdoMunicipal vigente para revalidar.
        RuleFor(x => x.IdPrestador)
            .GreaterThanOrEqualTo(0)
            .WithMessage("idPrestador debe ser >= 0 (0 = legacy EPC-LEGACY).");

        // Validación cruzada del Total. Tolerancia 0.01 por redondeo.
        RuleFor(x => x)
            .Must(x =>
            {
                var calculado = x.CargoFijo + x.CargoBasico + x.CargoExcedente - x.Subsidio + x.Contribucion;
                return Math.Abs(x.Total - calculado) <= 0.01m;
            })
            .WithMessage("Total debe ser igual a CargoFijo + CargoBasico + CargoExcedente - Subsidio + Contribucion (tolerancia 0.01).");

        // Regla cruzada vs AcuerdoMunicipal (revalidacion post-attach):
        // cuando el caller indica id_prestador, la revalidacion contra el
        // Acuerdo vigente la hace ServicioLiquidaciones (no el validator
        // puro) porque requiere IO a DB. Aqui dejamos la regla basica.

        RuleFor(x => x.IdCliente)
            .NotEmpty().MaximumLength(120);
    }
}
