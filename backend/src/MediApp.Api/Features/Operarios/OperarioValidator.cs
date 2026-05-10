using System.Text.RegularExpressions;
using FluentValidation;

namespace MediApp.Api.Features.Operarios;

public class OperarioValidator : AbstractValidator<OperarioPayload>
{
    private static readonly string[] RolesValidos = { "operario", "supervisor", "admin" };
    private static readonly string[] EstadosValidos = { "activo", "inactivo" };
    private static readonly Regex CedulaRegex = new(@"^\d{6,12}$", RegexOptions.Compiled);
    private static readonly Regex EmailRegex = new(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled);

    public OperarioValidator()
    {
        RuleFor(x => x.NumeroCedula)
            .NotEmpty()
            .Must(v => v is not null && CedulaRegex.IsMatch(v))
            .WithMessage("NumeroCedula debe tener entre 6 y 12 dígitos numéricos.");

        RuleFor(x => x.Nombre)
            .NotEmpty()
            .MaximumLength(150);

        RuleFor(x => x.Email)
            .NotEmpty()
            .MaximumLength(150)
            .Must(v => v is not null && EmailRegex.IsMatch(v))
            .WithMessage("Email debe tener formato válido (usuario@dominio.tld).");

        RuleFor(x => x.PasswordHash)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.Rol)
            .NotEmpty()
            .Must(r => r is not null && RolesValidos.Contains(r))
            .WithMessage($"Rol debe ser uno de: {string.Join(", ", RolesValidos)}.");

        RuleFor(x => x.Estado)
            .NotEmpty()
            .Must(e => e is not null && EstadosValidos.Contains(e))
            .WithMessage($"Estado debe ser uno de: {string.Join(", ", EstadosValidos)}.");

        RuleFor(x => x.DispositivoId)
            .MaximumLength(100)
            .When(x => x.DispositivoId is not null);

        RuleFor(x => x.CreatedAt)
            .NotEmpty()
            .MaximumLength(40);
    }
}
