using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace MediApp.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ModeloCompleto : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "medidores",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    codigo = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    id_suscriptor = table.Column<int>(type: "integer", nullable: false),
                    fecha_instalacion = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    estado = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    id_cliente = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_medidores", x => x.id);
                    table.ForeignKey(
                        name: "fk_medidores_suscriptores_id_suscriptor",
                        column: x => x.id_suscriptor,
                        principalTable: "suscriptores",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "sync_registros",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    id_cliente = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    tipo = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    hash_server = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    id_entidad = table.Column<int>(type: "integer", nullable: false),
                    fecha_sync = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sync_registros", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "lecturas",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    id_medidor = table.Column<int>(type: "integer", nullable: false),
                    lectura_actual = table.Column<decimal>(type: "numeric(12,3)", nullable: false),
                    lectura_anterior = table.Column<decimal>(type: "numeric(12,3)", nullable: false),
                    periodo = table.Column<string>(type: "char(6)", maxLength: 6, nullable: false),
                    id_operario = table.Column<int>(type: "integer", nullable: false),
                    timestamp_captura = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    observaciones = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    evidencia_foto_ruta = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    evidencia_foto_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    id_cliente = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_lecturas", x => x.id);
                    table.ForeignKey(
                        name: "fk_lecturas_medidores_id_medidor",
                        column: x => x.id_medidor,
                        principalTable: "medidores",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "liquidaciones",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    id_lectura = table.Column<int>(type: "integer", nullable: false),
                    consumo_m3 = table.Column<decimal>(type: "numeric(12,3)", nullable: false),
                    cargo_fijo = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    cargo_basico = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    cargo_excedente = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    subsidio = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    contribucion = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    total = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    estrato = table.Column<short>(type: "smallint", nullable: false),
                    id_cliente = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_liquidaciones", x => x.id);
                    table.ForeignKey(
                        name: "fk_liquidaciones_lecturas_id_lectura",
                        column: x => x.id_lectura,
                        principalTable: "lecturas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_lecturas_id_cliente",
                table: "lecturas",
                column: "id_cliente",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_lecturas_id_medidor",
                table: "lecturas",
                column: "id_medidor");

            migrationBuilder.CreateIndex(
                name: "ix_liquidaciones_id_cliente",
                table: "liquidaciones",
                column: "id_cliente",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_liquidaciones_id_lectura",
                table: "liquidaciones",
                column: "id_lectura",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_medidores_codigo",
                table: "medidores",
                column: "codigo",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_medidores_id_cliente",
                table: "medidores",
                column: "id_cliente",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_medidores_id_suscriptor",
                table: "medidores",
                column: "id_suscriptor");

            migrationBuilder.CreateIndex(
                name: "ix_sync_registros_id_cliente_tipo",
                table: "sync_registros",
                columns: new[] { "id_cliente", "tipo" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_sync_registros_tipo_id_entidad",
                table: "sync_registros",
                columns: new[] { "tipo", "id_entidad" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "liquidaciones");

            migrationBuilder.DropTable(
                name: "sync_registros");

            migrationBuilder.DropTable(
                name: "lecturas");

            migrationBuilder.DropTable(
                name: "medidores");
        }
    }
}
