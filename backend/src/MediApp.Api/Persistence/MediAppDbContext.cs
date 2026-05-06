using MediApp.Api.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace MediApp.Api.Persistence;

/// <summary>
/// DbContext raíz. Día 2 ya cubre el modelo completo (suscriptor, medidor, lectura,
/// liquidacion + sync_registro). Naming snake_case se aplica vía
/// UseSnakeCaseNamingConvention en Program.cs.
/// </summary>
public class MediAppDbContext : DbContext
{
    public MediAppDbContext(DbContextOptions<MediAppDbContext> options) : base(options)
    {
    }

    public DbSet<Suscriptor> Suscriptores => Set<Suscriptor>();
    public DbSet<Medidor> Medidores => Set<Medidor>();
    public DbSet<Lectura> Lecturas => Set<Lectura>();
    public DbSet<Liquidacion> Liquidaciones => Set<Liquidacion>();
    public DbSet<SyncRegistro> SyncRegistros => Set<SyncRegistro>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Suscriptor: documento e id_cliente únicos (un cliente offline = una entidad).
        modelBuilder.Entity<Suscriptor>()
            .HasIndex(s => s.Documento)
            .IsUnique();

        modelBuilder.Entity<Suscriptor>()
            .HasIndex(s => s.IdCliente)
            .IsUnique();

        // Medidor: codigo e id_cliente únicos.
        modelBuilder.Entity<Medidor>()
            .HasIndex(m => m.Codigo)
            .IsUnique();

        modelBuilder.Entity<Medidor>()
            .HasIndex(m => m.IdCliente)
            .IsUnique();

        modelBuilder.Entity<Medidor>()
            .HasOne(m => m.Suscriptor)
            .WithMany()
            .HasForeignKey(m => m.IdSuscriptor)
            .OnDelete(DeleteBehavior.Restrict);

        // Lectura: id_cliente único.
        modelBuilder.Entity<Lectura>()
            .HasIndex(l => l.IdCliente)
            .IsUnique();

        modelBuilder.Entity<Lectura>()
            .HasOne(l => l.Medidor)
            .WithMany()
            .HasForeignKey(l => l.IdMedidor)
            .OnDelete(DeleteBehavior.Restrict);

        // Liquidacion: id_lectura unique (1 lectura -> a lo sumo 1 liquidacion) e id_cliente unique.
        modelBuilder.Entity<Liquidacion>()
            .HasIndex(li => li.IdLectura)
            .IsUnique();

        modelBuilder.Entity<Liquidacion>()
            .HasIndex(li => li.IdCliente)
            .IsUnique();

        modelBuilder.Entity<Liquidacion>()
            .HasOne(li => li.Lectura)
            .WithMany()
            .HasForeignKey(li => li.IdLectura)
            .OnDelete(DeleteBehavior.Restrict);

        // SyncRegistro: unique compuesto (id_cliente, tipo) — un cliente:tipo => 1 sync activo.
        modelBuilder.Entity<SyncRegistro>()
            .HasIndex(sr => new { sr.IdCliente, sr.Tipo })
            .IsUnique();

        // Index secundario para búsquedas inversas (debug futuro: dado tipo+id server, hallar id_cliente).
        modelBuilder.Entity<SyncRegistro>()
            .HasIndex(sr => new { sr.Tipo, sr.IdEntidad });
    }
}
