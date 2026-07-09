using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MediApp.Api.Persistence.Migrations
{
    /// <summary>
    /// Migración que agrega los campos RepresentanteLegal y RepresentanteLegalCedula
    /// a la tabla prestadores. Requerido por SSRD/SSSPD para registrar al
    /// representante legal del prestador rural (Res CRA 825/2017 art. 6.4).
    ///
    /// Espejo del cambio en src/operarios/types.ts (mobile) durante fase 3.1.
    ///
    /// PATRÓN: Igual que 20260701_AgregarMultiTenant, esta migration no actualiza el
    /// model snapshot — el snapshot del proyecto está intencionalmente desincronizado
    /// respecto al modelo multi-tenant. Aplicar después de 20260701_AgregarMultiTenant.
    /// </summary>
    public partial class AgregarRepresentanteLegal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "representante_legal",
                table: "prestadores",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "representante_legal_cedula",
                table: "prestadores",
                type: "character varying(12)",
                maxLength: 12,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "representante_legal_cedula",
                table: "prestadores");

            migrationBuilder.DropColumn(
                name: "representante_legal",
                table: "prestadores");
        }
    }
}
