using FluentValidation;

namespace MediApp.Api.Features.ParametrosTarifa;

public class ParametrosTarifaValidator : AbstractValidator<ParametrosTarifaPayload>
{
    public ParametrosTarifaValidator()
    {
        RuleFor(x => x.IdPrestador).GreaterThan(0).WithMessage("id_prestador requerido");
        RuleFor(x => x.IdAcuerdo).GreaterThan(0).WithMessage("id_acuerdo requerido");
        RuleFor(x => x.Periodo).GreaterThanOrEqualTo(2000).WithMessage("periodo debe ser >= 2000");

        RuleFor(x => x.Cma).GreaterThanOrEqualTo(0).WithMessage("cma no puede ser negativo");
        RuleFor(x => x.Cmo).GreaterThanOrEqualTo(0).WithMessage("cmo no puede ser negativo");
        RuleFor(x => x.Cmi).GreaterThanOrEqualTo(0).WithMessage("cmi no puede ser negativo");
        RuleFor(x => x.Cmt).GreaterThanOrEqualTo(0).WithMessage("cmt no puede ser negativo");
        RuleFor(x => x.Cmviaa).GreaterThanOrEqualTo(0).WithMessage("cmviaa no puede ser negativo");

        RuleFor(x => x.AguaSuministradaM3Anio)
            .GreaterThanOrEqualTo(0).WithMessage("agua_suministrada_m3_anio no puede ser negativo");
        RuleFor(x => x.IpufM3SuscriptorMes)
            .GreaterThanOrEqualTo(0).WithMessage("ipuf_m3_suscriptor_mes no puede ser negativo");
        RuleFor(x => x.SuscriptoresPromedio)
            .GreaterThan(0).WithMessage("suscriptores_promedio debe ser > 0");

        RuleFor(x => x.M3GratisMinimoVital)
            .GreaterThanOrEqualTo(0).WithMessage("m3_gratis_minimo_vital no puede ser negativo");

        RuleFor(x => x.VigenteHasta)
            .GreaterThanOrEqualTo(x => x.VigenteDesde)
            .WithMessage("vigente_hasta debe ser >= vigente_desde");
    }
}
