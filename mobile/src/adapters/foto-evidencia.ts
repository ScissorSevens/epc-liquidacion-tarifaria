import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * Adapter de plataforma mobile para manejo de evidencia fotografica.
 *
 * Decision arquitectonica (Tarea 7):
 *  El port `Hasher` del dominio (string -> string) NO se modifica. Sirve
 *  para hashear payloads de factura. Hashear archivos binarios es
 *  responsabilidad de infraestructura mobile y se resuelve aca con
 *  `expo-crypto` + `expo-file-system`.
 *
 * Por que el SHA-256 se calcula sobre el string base64 (no sobre los bytes):
 *  La API de `expo-crypto` SDK 54 solo expone `digestStringAsync`, que
 *  recibe un string. No hay variante de digest sobre `Uint8Array` o
 *  `ArrayBuffer`.
 *
 *  Hasheamos el string base64 del contenido del archivo. Esto es:
 *   - Determinista respecto a los bytes binarios del archivo
 *     (mismos bytes -> mismo base64 -> mismo hash). Sirve para
 *     validar integridad dentro del propio sistema (captura vs
 *     validacion vs sync con backend si comparten la misma convencion).
 *   - NO equivalente al `sha256sum <archivo.jpg>` que un usuario
 *     correria fuera del sistema. Si en el futuro hace falta paridad
 *     con `sha256sum` externo, hay que migrar a un modulo nativo
 *     (por ejemplo react-native-quick-crypto) o esperar a que
 *     `expo-crypto` exponga digest sobre bytes.
 *
 *  El campo `EvidenciaFoto.foto_hash` del dominio acepta cualquier hex
 *  de 64 chars, asi que esta convencion calza con la validacion existente.
 */

/** Subdirectorio dentro de `Paths.document` donde se persisten las fotos. */
const SUBDIR_EVIDENCIAS = 'evidencias';

/**
 * Calcula SHA-256 (hex, 64 chars) del archivo apuntado por `uri`.
 *
 * Lee el contenido como base64 (string determinista respecto a los bytes
 * del archivo) y delega el digest a `expo-crypto`.
 */
export async function calcularSha256DeArchivo(uri: string): Promise<string> {
  const archivo = new File(uri);
  const base64 = await archivo.base64();
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    base64,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
  return hash;
}

export interface OpcionesPersistirFoto {
  id_medidor: number;
  id_periodo: string;
}

/**
 * Mueve la foto desde la URI temporal de la camara a un path estable
 * dentro del documentDirectory de la app. Devuelve la URI persistente
 * (file://...) lista para usarse como `EvidenciaFoto.foto_path`.
 *
 * Convencion de nombre: `lectura-{id_medidor}-{id_periodo}-{timestamp}.jpg`.
 *  - `id_medidor` y `id_periodo` permiten asociar visualmente el archivo.
 *  - `timestamp` (ms desde epoch) garantiza unicidad si el operario
 *    re-captura para la misma combinacion medidor+periodo.
 */
export async function persistirFoto(
  uriTemporal: string,
  opciones: OpcionesPersistirFoto,
): Promise<string> {
  const carpeta = new Directory(Paths.document, SUBDIR_EVIDENCIAS);
  if (!carpeta.exists) {
    carpeta.create({ intermediates: true });
  }
  const nombre =
    `lectura-${opciones.id_medidor}` +
    `-${opciones.id_periodo}` +
    `-${Date.now()}.jpg`;
  const destino = new File(carpeta, nombre);
  // `move` actualiza la `uri` del File de origen al destino.
  const fuente = new File(uriTemporal);
  fuente.move(destino);
  return destino.uri;
}
