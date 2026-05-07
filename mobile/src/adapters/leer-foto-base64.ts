// mobile/src/adapters/leer-foto-base64.ts
//
// Adapter `expo-file-system` para leer una foto del filesystem como
// base64 + derivar su MIME a partir de la extension.
//
// Por que esta separado:
//   El mapper `lectura-a-backend.ts` debe quedar Node-puro y
//   testeable sin nativos. Esta funcion encapsula la dependencia de
//   `expo-file-system` y se inyecta en el wiring real del bootstrap.
//   No tiene tests porque es puro I/O nativo (cubierto en QA manual).
//
// MIME derivado por extension:
//   - .jpg / .jpeg → image/jpeg
//   - .png         → image/png
//   - cualquier otra (incluido sin extension) → image/jpeg (default
//     conservador: la camara de Expo guarda JPEG por default).
//   Si en el futuro la app permite otros formatos (heic, webp), hay
//   que sofisticar este branch o leer el MIME real con un sniff de
//   bytes magicos.

import { File } from 'expo-file-system';

export async function leerFotoBase64(
  path: string,
): Promise<{ base64: string; mime: string }> {
  // Nueva API de expo-file-system v19+: la antigua `readAsStringAsync`
  // y `EncodingType.Base64` quedaron en `legacyWarnings` (deprecada).
  // `new File(uri).base64()` es el reemplazo idiomatico.
  const base64 = await new File(path).base64();
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  return { base64, mime };
}
