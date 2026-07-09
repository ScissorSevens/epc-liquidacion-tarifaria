using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MediApp.Api.Persistence.Migrations
{
    /// <summary>
    /// Migración que agrega la FK <c>id_prestador</c> a la tabla <c>operarios</c>
    /// como parte del modelo multi-tenant del programa "Agua la Vereda" de EPC.
    ///
    /// Comportamiento:
    ///   - <c>AddColumn</c>: nueva columna <c>id_prestador integer NOT NULL DEFAULT 0</c>.
    ///     Default 0 = prestador legacy "EPC-LEGACY" (id_prestador=0) que mantiene
    ///     compatibilidad con operarios preexistentes (espejo del patrón usado en
    ///     la migration 20260701_AgregarMultiTenant para suscriptores/lecturas/facturas).
    ///   - <c>CreateIndex</c>: índice no-único <c>ix_operarios_id_prestador</c> para
    ///     acelerar lookups por prestador (filtrado de operarios por tenant).
    ///   - <c>AddForeignKey</c>: FK a <c>prestadores(id_prestador)</c> con
    ///     <c>ON DELETE RESTRICT</c> — un prestador con operarios asignados
    ///     NO se puede eliminar. Protege la jerarquía multi-tenant.
    ///
    /// Espejo del cambio en <c>mobile/dominio/operarios/types.ts</c> durante
    /// la fase 3.2. SDD: <c>setup-inicial-multi-tenant-auth</c>, phase 3 task 3.4.
    ///
    /// PATRÓN: Igual que <c>20260701_AgregarMultiTenant</c> y
    /// <c>20260709222635_AgregarRepresentanteLegal</c>, esta migration NO actualiza
    /// el model snapshot — el snapshot del proyecto está intencionalmente
    /// desincronizado respecto al modelo multi-tenant. El resync del snapshot
    /// queda como follow-up futuro (no scope de este SDD).
    ///
    /// Aplicar después de <c>20260709222635_AgregarRepresentanteLegal</c>.
    /// </summary>
    public partial class AgregarIdPrestadorOperario : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. AddColumn: NOT NULL con default 0 → operarios preexistentes quedan
            //    automáticamente asignados al prestador legacy (EPC-LEGACY, id=0).
            //    Esto evita un paso de UPDATE manual post-migration y mantiene
            //    el invariante NOT NULL del modelo EF.
            migrationBuilder.AddColumn<int>(
                name: "id_prestador",
                table: "operarios",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // 2. CreateIndex: índice no-único sobre id_prestador para acelerar
            //    las queries típicas multi-tenant ("dame los operarios del prestador X").
            migrationBuilder.CreateIndex(
                name: "ix_operarios_id_prestador",
                table: "operarios",
                column: "id_prestador");

            // 3. AddForeignKey: FK a prestadores(id_prestador) con ON DELETE RESTRICT.
            //    Mismo comportamiento que las otras FKs multi-tenant (suscriptores,
            //    lecturas, facturas, liquidaciones) declaradas en
            //    20260701_AgregarMultiTenant — consistencia semántica.
            //    Un prestador con operarios asignados no se puede eliminar.
            migrationBuilder.AddForeignKey(
                name: "fk_operarios_prestadores_id_prestador",
                table: "operarios",
                column: "id_prestador",
                principalTable: "prestadores",
                principalColumn: "id_prestador",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Rollback: drop FK → drop index → drop column (orden inverso al Up).
            migrationBuilder.DropForeignKey(
                name: "fk_operarios_prestadores_id_prestador",
                table: "operarios");

            migrationBuilder.DropIndex(
                name: "ix_operarios_id_prestador",
                table: "operarios");

            migrationBuilder.DropColumn(
                name: "id_prestador",
                table: "operarios");
        }
    }
}
