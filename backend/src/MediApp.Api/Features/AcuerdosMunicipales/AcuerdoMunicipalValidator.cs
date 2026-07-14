using FluentValidation;

namespace MediApp.Api.Features.AcuerdosMunicipales;

public class AcuerdoMunicipalValidator : AbstractValidator<AcuerdoMunicipalPayload>
{
    public AcuerdoMunicipalValidator()
    {
        RuleFor(x => x.IdPrestador).GreaterThan(0).WithMessage("id_prestador requerido");

        // Topes L142/1994 art. 99.6
        RuleFor(x => x.FactorSubsidioE1)
            .InclusiveBetween(-1.0, -0.60)
            .WithMessage("factor_subsidio_e1 fuera de rango legal (-1.0 a -0.60)");

        RuleFor(x => x.FactorSubsidioE2)
            .InclusiveBetween(-1.0, -0.50)
            .WithMessage("factor_subsidio_e2 fuera de rango legal (-1.0 a -0.50)");

        RuleFor(x => x.FactorSubsidioE3)
            .InclusiveBetween(-1.0, -0.40)
            .WithMessage("factor_subsidio_e3 fuera de rango legal (-1.0 a -0.40)");

        RuleFor(x => x.FactorContribucionE5)
            .InclusiveBetween(0.0, 0.50)
            .WithMessage("factor_contribucion_e5 fuera de rango legal (0 a +0.50)");

        RuleFor(x => x.FactorContribucionE6)
            .InclusiveBetween(0.0, 0.60)
            .WithMessage("factor_contribucion_e6 fuera de rango legal (0 a +0.60)");

        RuleFor(x => x.FactorContribucionComercial)
            .GreaterThanOrEqualTo(0)
            .LessThanOrEqualTo(1.0)
            .WithMessage("factor_contribucion_comercial debe estar entre 0 y 1.0");

        RuleFor(x => x.FactorContribucionIndustrial)
            .GreaterThanOrEqualTo(0)
            .LessThanOrEqualTo(1.0)
            .WithMessage("factor_contribucion_industrial debe estar entre 0 y 1.0");

        RuleFor(x => x.FechaVigenciaDesde).NotEmpty();
        RuleFor(x => x.FechaVigenciaHasta)
            .GreaterThanOrEqualTo(x => x.FechaVigenciaDesde)
            .WithMessage("fecha_vigencia_hasta debe ser >= fecha_vigencia_desde");

        RuleFor(x => x.ActoAdministrativoUrl)
            .MaximumLength(500)
            .When(x => !string.IsNullOrEmpty(x.ActoAdministrativoUrl));

        RuleFor(x => x.Observaciones)
            .MaximumLength(2000)
            .When(x => !string.IsNullOrEmpty(x.Observaciones));
    }
}
