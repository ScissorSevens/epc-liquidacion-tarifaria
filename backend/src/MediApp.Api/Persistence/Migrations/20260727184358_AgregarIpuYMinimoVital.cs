using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MediApp.Api.Persistence.Migrations
{
    /// <inheritdoc />
    /// <summary>
    /// Res CRA 825/2017 compliance para ParametrosTarifa.
    /// Migración INCREMENTAL: agrega 4 columnas a parametros_tarifa
    /// y crea la tabla minimo_vital (1:1 con prestador).
    /// </summary>
    public partial class AgregarIpuYMinimoVital : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1) ParametrosTarifa: 4 columnas nuevas.
            migrationBuilder.AddColumn<double>(
                name: "ipuf_indice",
                table: "parametros_tarifa",
                type: "double precision",
                nullable: false,
                defaultValue: 1.0);

            migrationBuilder.AddColumn<double>(
                name: "cargo_fijo_resultante",
                table: "parametros_tarifa",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "cargo_consumo_resultante",
                table: "parametros_tarifa",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<string[]>(
                name: "componentes_aplicables",
                table: "parametros_tarifa",
                type: "jsonb",
                nullable: false,
                defaultValue: new string[0]);

            // 2) Tabla minimo_vital: 1:1 con prestador.
            migrationBuilder.CreateTable(
                name: "minimos_vitales",
                columns: table => new
                {
                    id_minimo_vital = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    id_prestador = table.Column<int>(type: "integer", nullable: false),
                    metros_cubicos = table.Column<int>(type: "integer", nullable: true),
                    estratos_aplica = table.Column<int[]>(type: "jsonb", nullable: false),
                    vigente_desde = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    vigente_hasta = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_minimos_vitales", x => x.id_minimo_vital);
                    table.ForeignKey(
                        name: "fk_minimos_vitales_prestadores_id_prestador",
                        column: x => x.id_prestador,
                        principalTable: "prestadores",
                        principalColumn: "id_prestador",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_minimos_vitales_id_prestador_vigente_desde",
                table: "minimos_vitales",
                columns: new[] { "id_prestador", "vigente_desde" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_minimos_vitales_id_prestador",
                table: "minimos_vitales",
                column: "id_prestador");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "minimos_vitales");

            migrationBuilder.DropColumn(name: "componentes_aplicables", table: "parametros_tarifa");
            migrationBuilder.DropColumn(name: "cargo_consumo_resultante", table: "parametros_tarifa");
            migrationBuilder.DropColumn(name: "cargo_fijo_resultante", table: "parametros_tarifa");
            migrationBuilder.DropColumn(name: "ipuf_indice", table: "parametros_tarifa");
        }
    }
}
