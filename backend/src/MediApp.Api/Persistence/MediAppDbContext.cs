using MediApp.Api.Dominio.Entidades;
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

    public DbSet<Operario> Operarios => Set<Operario>();
    public DbSet<Suscriptor> Suscriptores => Set<Suscriptor>();
    public DbSet<Medidor> Medidores => Set<Medidor>();
    public DbSet<Lectura> Lecturas => Set<Lectura>();
    public DbSet<Liquidacion> Liquidaciones => Set<Liquidacion>();
    public DbSet<SyncRegistro> SyncRegistros => Set<SyncRegistro>();
    // Multi-tenant (cambio motor-tarifario-cra-825-2017-multitenant):
    public DbSet<Prestador> Prestadores => Set<Prestador>();
    public DbSet<AcuerdoMunicipal> AcuerdosMunicipales => Set<AcuerdoMunicipal>();
    public DbSet<ParametrosTarifa> ParametrosTarifa => Set<ParametrosTarifa>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Suscriptor: codigo e id_cliente unicos (un cliente offline = una entidad).
        modelBuilder.Entity<Suscriptor>()
            .HasIndex(s => s.Codigo)
            .IsUnique();

        modelBuilder.Entity<Suscriptor>()
            .HasIndex(s => s.IdCliente)
            .IsUnique();

        // Medidor: numero_medidor e id_cliente unicos.
        modelBuilder.Entity<Medidor>()
            .HasIndex(m => m.NumeroMedidor)
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

        // Operario: numero_cedula, email y dispositivo_id únicos.
        modelBuilder.Entity<Operario>()
            .HasIndex(o => o.NumeroCedula).IsUnique();

        modelBuilder.Entity<Operario>()
            .HasIndex(o => o.Email).IsUnique();

        // NULL no viola UNIQUE en Postgres — múltiples operarios sin dispositivo son válidos.
        modelBuilder.Entity<Operario>()
            .HasIndex(o => o.DispositivoId).IsUnique();

        // Lectura → Operario: FK nullable, lecturas históricas conservan IdOperario = NULL.
        modelBuilder.Entity<Lectura>()
            .HasOne(l => l.Operario)
            .WithMany()
            .HasForeignKey(l => l.IdOperario)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        // ===== Multi-tenant: Prestador + Acuerdo + ParametrosTarifa =====

        modelBuilder.Entity<Prestador>()
            .HasIndex(p => p.Codigo)
            .IsUnique();
        modelBuilder.Entity<Prestador>()
            .HasIndex(p => p.Municipio);
        modelBuilder.Entity<Prestador>()
            .HasIndex(p => p.Estado);

        modelBuilder.Entity<AcuerdoMunicipal>()
            .HasIndex(a => new { a.IdPrestador, a.FechaVigenciaDesde, a.FechaVigenciaHasta });

        modelBuilder.Entity<ParametrosTarifa>()
            .HasIndex(p => new { p.IdPrestador, p.Periodo });
        modelBuilder.Entity<ParametrosTarifa>()
            .HasIndex(p => new { p.IdPrestador, p.Periodo, p.VigenteDesde })
            .IsUnique();

        // Multi-tenant FKs en entidades existentes
        modelBuilder.Entity<Suscriptor>()
            .HasOne(s => s.Prestador)
            .WithMany()
            .HasForeignKey(s => s.IdPrestador)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Suscriptor>()
            .HasIndex(s => s.IdPrestador);

        modelBuilder.Entity<Lectura>()
            .HasOne(l => l.Prestador)
            .WithMany()
            .HasForeignKey(l => l.IdPrestador)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Lectura>()
            .HasIndex(l => l.IdPrestador);

        modelBuilder.Entity<Liquidacion>()
            .HasOne(li => li.Prestador)
            .WithMany()
            .HasForeignKey(li => li.IdPrestador)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Liquidacion>()
            .HasIndex(li => li.IdPrestador);

        modelBuilder.Entity<AcuerdoMunicipal>()
            .HasOne(a => a.Prestador)
            .WithMany()
            .HasForeignKey(a => a.IdPrestador)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ParametrosTarifa>()
            .HasOne(p => p.Prestador)
            .WithMany()
            .HasForeignKey(p => p.IdPrestador)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ParametrosTarifa>()
            .HasOne(p => p.Acuerdo)
            .WithMany()
            .HasForeignKey(p => p.IdAcuerdo)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
