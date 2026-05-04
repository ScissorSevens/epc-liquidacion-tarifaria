/**
 * Bootstrap del modulo persistencia de lecturas con backend SQLite.
 *
 * Punto de entrada cableado que: abre conexion SQLite con `dbPath`
 * configurable, ejecuta migraciones pendientes idempotentemente, y
 * devuelve el `LecturaRepository` listo para usar junto con una funcion
 * de cierre limpio.
 *
 * Hexagonal: este modulo es composition root de infra. NO contiene
 * logica de dominio; solo cablea adapter (`crearLecturaRepositorySqlite`)
 * con infra (`crearConexion`, `ejecutarMigrations`).
 *
 * Espejo intencional de `src/factura/bootstrap.ts`. Si el patron de
 * bootstrap evoluciona (ej. inyeccion de logger), tocar AMBOS para
 * mantener consistencia entre modulos de persistencia.
 */

// scaffold: cuerpo se completa en el GREEN del cycle 4
export {};
