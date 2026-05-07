using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MediApp.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ReconciliarConDominioMobile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_suscriptores_documento",
                table: "suscriptores");

            migrationBuilder.DropIndex(
                name: "ix_medidores_codigo",
                table: "medidores");

            migrationBuilder.DropColumn(
                name: "documento",
                table: "suscriptores");

            migrationBuilder.DropColumn(
                name: "fecha_alta",
                table: "suscriptores");

            migrationBuilder.DropColumn(
                name: "codigo",
                table: "medidores");

            migrationBuilder.RenameColumn(
                name: "nombre",
                table: "suscriptores",
                newName: "nombre_apellidos");

            migrationBuilder.AlterColumn<string>(
                name: "direccion",
                table: "suscriptores",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200,
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "codigo",
                table: "suscriptores",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "created_at",
                table: "suscriptores",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "matricula_inmobiliaria",
                table: "suscriptores",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "numero_catastral",
                table: "suscriptores",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "fecha_instalacion",
                table: "medidores",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                oldClrType: typeof(DateTimeOffset),
                oldType: "timestamp with time zone");

            migrationBuilder.AddColumn<string>(
                name: "numero_medidor",
                table: "medidores",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "observaciones",
                table: "medidores",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_suscriptores_codigo",
                table: "suscriptores",
                column: "codigo",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_medidores_numero_medidor",
                table: "medidores",
                column: "numero_medidor",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_suscriptores_codigo",
                table: "suscriptores");

            migrationBuilder.DropIndex(
                name: "ix_medidores_numero_medidor",
                table: "medidores");

            migrationBuilder.DropColumn(
                name: "codigo",
                table: "suscriptores");

            migrationBuilder.DropColumn(
                name: "created_at",
                table: "suscriptores");

            migrationBuilder.DropColumn(
                name: "matricula_inmobiliaria",
                table: "suscriptores");

            migrationBuilder.DropColumn(
                name: "numero_catastral",
                table: "suscriptores");

            migrationBuilder.DropColumn(
                name: "numero_medidor",
                table: "medidores");

            migrationBuilder.DropColumn(
                name: "observaciones",
                table: "medidores");

            migrationBuilder.RenameColumn(
                name: "nombre_apellidos",
                table: "suscriptores",
                newName: "nombre");

            migrationBuilder.AlterColumn<string>(
                name: "direccion",
                table: "suscriptores",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200);

            migrationBuilder.AddColumn<string>(
                name: "documento",
                table: "suscriptores",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "fecha_alta",
                table: "suscriptores",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "fecha_instalacion",
                table: "medidores",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(10)",
                oldMaxLength: 10);

            migrationBuilder.AddColumn<string>(
                name: "codigo",
                table: "medidores",
                type: "character varying(80)",
                maxLength: 80,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "ix_suscriptores_documento",
                table: "suscriptores",
                column: "documento",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_medidores_codigo",
                table: "medidores",
                column: "codigo",
                unique: true);
        }
    }
}
