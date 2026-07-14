using System.Text.RegularExpressions;
using FluentValidation;

namespace MediApp.Api.Features.Prestadores;

public class PrestadorValidator : AbstractValidator<PrestadorPayload>
{
    private static readonly Regex CodigoRegex = new(@"^[A-Za-z0-9\-]{1,50}$", RegexOptions.Compiled);
    private static readonly Regex NitRegex = new(@"^\d{1,20}$", RegexOptions.Compiled);
    private static readonly Regex TextoRegex = new(@"^[\p{L}\p{N}\s\.\,\-\(\)\#\/]+$", RegexOptions.Compiled);

    public PrestadorValidator()
    {
        RuleFor(x => x.Codigo)
            .NotEmpty().WithMessage("codigo requerido")
            .MaximumLength(50).WithMessage("codigo maximo 50 caracteres")
            .Must(v => CodigoRegex.IsMatch(v ?? string.Empty))
            .WithMessage("codigo solo permite letras, digitos y guiones");

        RuleFor(x => x.Nombre)
            .NotEmpty().WithMessage("nombre requerido")
            .MaximumLength(200).WithMessage("nombre maximo 200 caracteres");

        RuleFor(x => x.Nit)
            .NotEmpty().WithMessage("nit requerido")
            .MaximumLength(20).WithMessage("nit maximo 20 caracteres")
            .Must(v => NitRegex.IsMatch(v ?? string.Empty))
            .WithMessage("nit solo permite digitos");

        RuleFor(x => x.Municipio)
            .NotEmpty().WithMessage("municipio requerido")
            .MaximumLength(100).WithMessage("municipio maximo 100 caracteres");

        RuleFor(x => x.Departamento)
            .NotEmpty().WithMessage("departamento requerido")
            .MaximumLength(100).WithMessage("departamento maximo 100 caracteres");

        RuleFor(x => x.Segmento)
            .InclusiveBetween((short)1, (short)2)
            .WithMessage("segmento debe ser 1 o 2 (Res CRA 825/2017 art. 6)");

        RuleFor(x => x.NumSuscriptoresUrbanos).GreaterThanOrEqualTo(0);
        RuleFor(x => x.NumSuscriptoresRurales).GreaterThanOrEqualTo(0);

        RuleFor(x => x.Contacto)
            .MaximumLength(200)
            .When(x => !string.IsNullOrEmpty(x.Contacto));

        RuleFor(x => x.Estado)
            .Must(v => v == "activo" || v == "suspendido")
            .WithMessage("estado debe ser 'activo' o 'suspendido'");
    }
}
