using MediApp.Api.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace MediApp.Api.Persistence;

/// <summary>
/// DbContext raíz. Día 1 solo expone Suscriptores; el resto de aggregates llega Día 2+.
/// Naming convention snake_case se aplica vía UseSnakeCaseNamingConvention en Program.cs.
/// </summary>
public class MediAppDbContext : DbContext
{
    public MediAppDbContext(DbContextOptions<MediAppDbContext> options) : base(options)
    {
    }

    public DbSet<Suscriptor> Suscriptores => Set<Suscriptor>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Constraints de unicidad. Las anotaciones [Required]/[MaxLength] cubren el resto.
        modelBuilder.Entity<Suscriptor>()
            .HasIndex(s => s.Documento)
            .IsUnique();

        modelBuilder.Entity<Suscriptor>()
            .HasIndex(s => s.IdCliente)
            .IsUnique();
    }
}
