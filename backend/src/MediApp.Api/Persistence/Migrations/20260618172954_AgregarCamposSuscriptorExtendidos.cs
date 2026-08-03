using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MediApp.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AgregarCamposSuscriptorExtendidos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "aplica_subsidio",
                table: "suscriptores",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "cedula",
                table: "suscriptores",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "municipio",
                table: "suscriptores",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "sector",
                table: "suscriptores",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "aplica_subsidio",
                table: "suscriptores");

            migrationBuilder.DropColumn(
                name: "cedula",
                table: "suscriptores");

            migrationBuilder.DropColumn(
                name: "municipio",
                table: "suscriptores");

            migrationBuilder.DropColumn(
                name: "sector",
                table: "suscriptores");
        }
    }
}
