using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MediApp.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AgregarSuscriptorEmailTelefono : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "email",
                table: "suscriptores",
                type: "character varying(254)",
                maxLength: 254,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "telefono",
                table: "suscriptores",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_suscriptores_email",
                table: "suscriptores",
                column: "email");

            migrationBuilder.CreateIndex(
                name: "ix_suscriptores_telefono",
                table: "suscriptores",
                column: "telefono");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_suscriptores_email",
                table: "suscriptores");

            migrationBuilder.DropIndex(
                name: "ix_suscriptores_telefono",
                table: "suscriptores");

            migrationBuilder.DropColumn(
                name: "email",
                table: "suscriptores");

            migrationBuilder.DropColumn(
                name: "telefono",
                table: "suscriptores");
        }
    }
}
