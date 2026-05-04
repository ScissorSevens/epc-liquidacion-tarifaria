/**
 * Bootstrap del módulo factura con backend SQLite.
 *
 * Punto de entrada cableado que: abre conexión SQLite con `dbPath`
 * configurable, ejecuta migraciones pendientes idempotentemente, y
 * devuelve el `FacturaRepository` listo para usar junto con una función
 * de cierre limpio.
 *
 * Hexagonal: este módulo es composition root de infra. NO contiene
 * lógica de dominio; solo cablea adapter (`crearFacturaRepositorySqlite`)
 * con infra (`crearConexion`, `ejecutarMigrations`).
 */
