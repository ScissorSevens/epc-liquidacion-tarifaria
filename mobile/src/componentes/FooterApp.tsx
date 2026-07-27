/**
 * FooterApp — slot reservado para el footer institucional.
 *
 * DECISIÓN DE PRODUCTO (2026-07-26): el footer global está desactivado.
 * Retornamos `null` para que las 14 pantallas que importan este
 * componente (Login, MiPerfil, Configuracion, CapturarFoto,
 * CapturarLectura, DetalleSuscriptor, EditarSuscriptor, AltaSuscriptor,
 * ListaSuscriptores, RutaDeHoy, Historial, ImportarCsv, ResultadoCalculo,
 * Sincronizacion) sigan compilando sin mostrar el banner de versión.
 *
 * Cuando se reactive, el contenido debe respetar los principios
 * impecable v1 (register product) — los tests de regresion en
 * `__tests__/componentes/FooterApp.test.tsx` son la red de seguridad:
 *
 *   - T-FOOTER-1   Sin hex hardcoded en backgroundColor / borderColor / color.
 *                  Usar tokens `COLORS.brandAzulOscuro`, `COLORS.onSurfaceVariant`,
 *                  `COLORS.surfaceVariant`, etc.
 *   - T-FOOTER-2   Sin textTransform: 'uppercase'. La copia va en Title Case
 *                  ("EPC · Versión 1.0.0"), no en ALL CAPS.
 *   - T-FOOTER-3   Sin ghost-card: no combinar borderWidth >= 1 con elevation
 *                  o shadowRadius en el mismo bloque. Border solo o shadow solo.
 *   - T-FOOTER-4   El subtree renderizado debe seguir siendo null mientras
 *                  esté desactivado.
 *
 * Contexto histórico:
 *   Antes este componente mostraba un banner con la versión de la app.
 *   Se removió porque (a) ocupaba espacio sin valor informativo real
 *   para operarios rurales, y (b) el campo "versión" ya vive en la
 *   pantalla MiPerfil. Si en el futuro hace falta un footer (e.g.
 *   indicador de batería de sincronización, timestamp del último sync),
 *   se reactiva acá y los tests siguen siendo la fuente de verdad.
 */
export function FooterApp() {
  return null;
}