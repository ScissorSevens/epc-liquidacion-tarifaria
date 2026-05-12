using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace MediApp.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AgregarOperarios : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_sync_registros_tipo_id_entidad",
                table: "sync_registros");

            migrationBuilder.AlterColumn<int>(
                name: "id_operario",
                table: "lecturas",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.CreateTable(
                name: "operarios",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    numero_cedula = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    nombre = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    email = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    password_hash = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    rol = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    estado = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    dispositivo_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    created_at = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_operarios", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_lecturas_id_operario",
                table: "lecturas",
                column: "id_operario");

            migrationBuilder.CreateIndex(
                name: "ix_operarios_dispositivo_id",
                table: "operarios",
                column: "dispositivo_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_operarios_email",
                table: "operarios",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_operarios_numero_cedula",
                table: "operarios",
                column: "numero_cedula",
                unique: true);

            // Limpiar id_operario huérfanos antes de crear la FK
            // (lecturas existentes pueden tener id_operario con valores que no existen en operarios)
            migrationBuilder.Sql("UPDATE lecturas SET id_operario = NULL WHERE id_operario IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "fk_lecturas_operarios_id_operario",
                table: "lecturas",
                column: "id_operario",
                principalTable: "operarios",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_lecturas_operarios_id_operario",
                table: "lecturas");

            migrationBuilder.DropTable(
                name: "operarios");

            migrationBuilder.DropIndex(
                name: "ix_lecturas_id_operario",
                table: "lecturas");

            migrationBuilder.AlterColumn<int>(
                name: "id_operario",
                table: "lecturas",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_sync_registros_tipo_id_entidad",
                table: "sync_registros",
                columns: new[] { "tipo", "id_entidad" });
        }
    }
}
