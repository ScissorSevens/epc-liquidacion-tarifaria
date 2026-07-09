using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;
using System;

#nullable disable

namespace MediApp.Api.Persistence.Migrations
{
    /// <summary>
    /// Migración que crea el modelo multi-tenant para el programa "Agua la
    /// Vereda" de EPC: prestadores rurales, sus Acuerdos Municipales y
    /// Parámetros Tarifarios conforme a Res CRA 825/2017 + 907/2019.
    ///
    /// Crea 3 tablas nuevas (prestadores, acuerdo_municipales, parametros_tarifa)
    /// y agrega FK id_prestador + categoria_uso a las tablas existentes
    /// (suscriptores, lecturas, facturas, liquidaciones).
    /// </summary>
    public partial class AgregarMultiTenant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Crear tabla prestadores
            migrationBuilder.CreateTable(
                name: "prestadores",
                columns: table => new
                {
                    id_prestador = table.Column<int>(nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    codigo = table.Column<string>(maxLength: 50, nullable: false),
                    nombre = table.Column<string>(maxLength: 200, nullable: false),
                    nit = table.Column<string>(maxLength: 20, nullable: false),
                    municipio = table.Column<string>(maxLength: 100, nullable: false),
                    departamento = table.Column<string>(maxLength: 100, nullable: false),
                    segmento = table.Column<short>(nullable: false),
                    num_suscriptores_urbanos = table.Column<int>(nullable: false, defaultValue: 0),
                    num_suscriptores_rurales = table.Column<int>(nullable: false, defaultValue: 0),
                    contacto = table.Column<string>(maxLength: 200, nullable: true),
                    estado = table.Column<string>(maxLength: 20, nullable: false, defaultValue: "activo"),
                    created_at = table.Column<DateTime>(nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(nullable: false, defaultValueSql: "now()"),
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_prestadores", x => x.id_prestador);
                    table.UniqueConstraint("uk_prestadores_codigo", x => x.codigo);
                    table.CheckConstraint("ck_prestadores_segmento", "segmento IN (1, 2)");
                    table.CheckConstraint("ck_prestadores_estado", "estado IN ('activo', 'suspendido')");
                });
            migrationBuilder.CreateIndex(name: "ix_prestadores_municipio", table: "prestadores", column: "municipio");
            migrationBuilder.CreateIndex(name: "ix_prestadores_estado", table: "prestadores", column: "estado");

            // 2. Crear tabla acuerdo_municipales
            migrationBuilder.CreateTable(
                name: "acuerdo_municipales",
                columns: table => new
                {
                    id_acuerdo = table.Column<int>(nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    id_prestador = table.Column<int>(nullable: false),
                    factor_subsidio_e1 = table.Column<double>(nullable: false),
                    factor_subsidio_e2 = table.Column<double>(nullable: false),
                    factor_subsidio_e3 = table.Column<double>(nullable: false),
                    factor_contribucion_e5 = table.Column<double>(nullable: false),
                    factor_contribucion_e6 = table.Column<double>(nullable: false),
                    factor_contribucion_comercial = table.Column<double>(nullable: false, defaultValue: 0.50),
                    factor_contribucion_industrial = table.Column<double>(nullable: false, defaultValue: 0.30),
                    fecha_vigencia_desde = table.Column<DateTime>(nullable: false),
                    fecha_vigencia_hasta = table.Column<DateTime>(nullable: false),
                    acto_administrativo_url = table.Column<string>(maxLength: 500, nullable: true),
                    observaciones = table.Column<string>(maxLength: 2000, nullable: true),
                    created_at = table.Column<DateTime>(nullable: false, defaultValueSql: "now()"),
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_acuerdo_municipales", x => x.id_acuerdo);
                    table.ForeignKey("fk_acuerdo_municipales_prestador", x => x.id_prestador, principalTable: "prestadores", principalColumn: "id_prestador", onDelete: ReferentialAction.Cascade);
                    table.CheckConstraint("ck_acuerdo_factor_e1", "factor_subsidio_e1 <= 0 AND factor_subsidio_e1 >= -1");
                    table.CheckConstraint("ck_acuerdo_factor_e2", "factor_subsidio_e2 <= 0 AND factor_subsidio_e2 >= -1");
                    table.CheckConstraint("ck_acuerdo_factor_e3", "factor_subsidio_e3 <= 0 AND factor_subsidio_e3 >= -1");
                    table.CheckConstraint("ck_acuerdo_factor_e5", "factor_contribucion_e5 >= 0");
                    table.CheckConstraint("ck_acuerdo_factor_e6", "factor_contribucion_e6 >= 0");
                });
            migrationBuilder.CreateIndex(name: "ix_acuerdo_municipales_prestador", table: "acuerdo_municipales", column: "id_prestador");
            migrationBuilder.CreateIndex(name: "ix_acuerdo_municipales_vigencia", table: "acuerdo_municipales", columns: new[] { "id_prestador", "fecha_vigencia_desde" });

            // 3. Crear tabla parametros_tarifa
            migrationBuilder.CreateTable(
                name: "parametros_tarifa",
                columns: table => new
                {
                    id_parametros = table.Column<int>(nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    id_prestador = table.Column<int>(nullable: false),
                    id_acuerdo = table.Column<int>(nullable: false),
                    periodo = table.Column<int>(nullable: false),
                    cma = table.Column<double>(nullable: false),
                    cmo = table.Column<double>(nullable: false),
                    cmi = table.Column<double>(nullable: false),
                    cmt = table.Column<double>(nullable: false),
                    cmviaa = table.Column<double>(nullable: false, defaultValue: 0.0),
                    aplica_cmviaa = table.Column<bool>(nullable: false, defaultValue: false),
                    agua_suministrada_m3_anio = table.Column<double>(nullable: false),
                    ipuf_m3_suscriptor_mes = table.Column<double>(nullable: false, defaultValue: 6.0),
                    suscriptores_promedio = table.Column<int>(nullable: false),
                    aplica_minimo_vital = table.Column<bool>(nullable: false, defaultValue: false),
                    m3_gratis_minimo_vital = table.Column<int>(nullable: false, defaultValue: 0),
                    vigente_desde = table.Column<DateTime>(nullable: false),
                    vigente_hasta = table.Column<DateTime>(nullable: false),
                    created_at = table.Column<DateTime>(nullable: false, defaultValueSql: "now()"),
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_parametros_tarifa", x => x.id_parametros);
                    table.ForeignKey("fk_parametros_tarifa_prestador", x => x.id_prestador, principalTable: "prestadores", principalColumn: "id_prestador", onDelete: ReferentialAction.Cascade);
                    table.ForeignKey("fk_parametros_tarifa_acuerdo", x => x.id_acuerdo, principalTable: "acuerdo_municipales", principalColumn: "id_acuerdo", onDelete: ReferentialAction.Restrict);
                    table.CheckConstraint("ck_parametros_periodo", "periodo >= 2000");
                    table.CheckConstraint("ck_parametros_ipuf", "ipuf_m3_suscriptor_mes >= 0");
                    table.CheckConstraint("ck_parametros_suscriptores", "suscriptores_promedio > 0");
                });
            migrationBuilder.CreateIndex(name: "ix_parametros_tarifa_prestador_periodo", table: "parametros_tarifa", columns: new[] { "id_prestador", "periodo" });

            // 4. Insertar prestador legacy "EPC-LEGACY" id=0 para compatibilidad
            migrationBuilder.Sql(@"
                INSERT INTO prestadores (id_prestador, codigo, nombre, nit, municipio, departamento, segmento, num_suscriptores_urbanos, num_suscriptores_rurales, contacto, estado, created_at, updated_at)
                VALUES (0, 'EPC-LEGACY', 'EPC prestador legacy (compatibilidad)', '000000000-0', 'Bogota', 'Cundinamarca', 1, 0, 0, NULL, 'activo', now(), now())
                ON CONFLICT (id_prestador) DO NOTHING;
                SELECT setval(pg_get_serial_sequence('prestadores', 'id_prestador'), 0, true);
            ");

            // 5. ALTER TABLE suscriptores — agregar id_prestador y categoria_uso
            migrationBuilder.AddColumn<int>(
                name: "id_prestador",
                table: "suscriptores",
                type: "integer",
                nullable: false,
                defaultValue: 0);
            migrationBuilder.AddColumn<string>(
                name: "categoria_uso",
                table: "suscriptores",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "residencial");
            migrationBuilder.CreateIndex(name: "ix_suscriptores_prestador", table: "suscriptores", column: "id_prestador");
            migrationBuilder.Sql(@"
                ALTER TABLE suscriptores
                ADD CONSTRAINT fk_suscriptores_prestador
                FOREIGN KEY (id_prestador) REFERENCES prestadores(id_prestador) NOT VALID;
            ");
            migrationBuilder.Sql(@"
                ALTER TABLE suscriptores
                VALIDATE CONSTRAINT fk_suscriptores_prestador;
            ");

            // 6. ALTER TABLE lecturas — denormalizar id_prestador
            migrationBuilder.AddColumn<int>(
                name: "id_prestador",
                table: "lecturas",
                type: "integer",
                nullable: false,
                defaultValue: 0);
            migrationBuilder.CreateIndex(name: "ix_lecturas_prestador", table: "lecturas", column: "id_prestador");

            // 7. ALTER TABLE facturas — denormalizar id_prestador
            migrationBuilder.AddColumn<int>(
                name: "id_prestador",
                table: "facturas",
                type: "integer",
                nullable: false,
                defaultValue: 0);
            migrationBuilder.CreateIndex(name: "ix_facturas_prestador", table: "facturas", column: "id_prestador");

            // 8. ALTER TABLE liquidaciones — denormalizar id_prestador
            migrationBuilder.AddColumn<int>(
                name: "id_prestador",
                table: "liquidaciones",
                type: "integer",
                nullable: false,
                defaultValue: 0);
            migrationBuilder.CreateIndex(name: "ix_liquidaciones_prestador", table: "liquidaciones", column: "id_prestador");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Rollback: DROP FK + columnas denormalizadas + tablas nuevas
            migrationBuilder.DropIndex(name: "ix_liquidaciones_prestador", table: "liquidaciones");
            migrationBuilder.DropColumn(name: "id_prestador", table: "liquidaciones");

            migrationBuilder.DropIndex(name: "ix_facturas_prestador", table: "facturas");
            migrationBuilder.DropColumn(name: "id_prestador", table: "facturas");

            migrationBuilder.DropIndex(name: "ix_lecturas_prestador", table: "lecturas");
            migrationBuilder.DropColumn(name: "id_prestador", table: "lecturas");

            migrationBuilder.Sql("ALTER TABLE suscriptores DROP CONSTRAINT IF EXISTS fk_suscriptores_prestador;");
            migrationBuilder.DropIndex(name: "ix_suscriptores_prestador", table: "suscriptores");
            migrationBuilder.DropColumn(name: "categoria_uso", table: "suscriptores");
            migrationBuilder.DropColumn(name: "id_prestador", table: "suscriptores");

            migrationBuilder.DropTable(name: "parametros_tarifa");
            migrationBuilder.DropTable(name: "acuerdo_municipales");
            migrationBuilder.DropTable(name: "prestadores");
        }
    }
}
