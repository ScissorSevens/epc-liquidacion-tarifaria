/**
 * Wrapper AsyncStorage para preferencias de impresora Bluetooth.
 *
 * Shape `PreferenciasImpresion` con `version: 1`. Una sola key:
 * `@impresion:preferencias:v1`. Validacion de shape + fallback
 * limpio en caso de JSON corrupto o version futura.
 *
 * NO SQLite (propuesta D2): evita una migration nueva y mantiene
 * el rollback trivial.
 *
 * Spec: `impresora-perfil-preferences` REQ 1-5.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AnchoPapel, Impresora } from '@dominio/impresion';

export const KEY_PREFERENCIAS_IMPRESION =
  'impresion.preferencias.v1';

const VERSION_ACTUAL = 1;
const ANCHOS_VALIDOS: readonly AnchoPapel[] = ['58mm', '80mm'];

interface PreferenciasV1 {
  readonly version: 1;
  readonly ultima_impresora: Impresora | null;
  readonly papel_default: AnchoPapel;
}

const PREFERENCIAS_VACIAS: PreferenciasV1 = Object.freeze({
  version: VERSION_ACTUAL,
  ultima_impresora: null,
  papel_default: '58mm' as AnchoPapel,
});

function validarAncho(ancho: unknown): ancho is AnchoPapel {
  return typeof ancho === 'string' && (ANCHOS_VALIDOS as readonly string[]).includes(ancho);
}

function validarImpresora(obj: unknown): obj is Impresora | null {
  if (obj === null) return true;
  if (typeof obj !== 'object' || obj === null) return false;
  const i = obj as Record<string, unknown>;
  return (
    typeof i.id === 'string' &&
    typeof i.nombre === 'string' &&
    (i.transporte === 'BLE' || i.transporte === 'SPP') &&
    typeof i.direccion === 'string' &&
    validarAncho(i.anchoPapel) &&
    (i.estado === 'emparejada' || i.estado === 'disponible' || i.estado === 'error')
  );
}

function parsearSeguro(raw: string | null): PreferenciasV1 {
  if (raw === null) return PREFERENCIAS_VACIAS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // eslint-disable-next-line no-console
    console.warn(`[impresoras-preferencias] JSON invalido, fallback a vacias`);
    return PREFERENCIAS_VACIAS;
  }
  if (typeof parsed !== 'object' || parsed === null) return PREFERENCIAS_VACIAS;
  const p = parsed as Record<string, unknown>;
  if (p.version !== VERSION_ACTUAL) {
    // eslint-disable-next-line no-console
    console.warn(
      `[impresoras-preferencias] version ${String(p.version)} != ${VERSION_ACTUAL}, fallback a vacias`,
    );
    return PREFERENCIAS_VACIAS;
  }
  const ultima = p.ultima_impresora;
  if (!validarImpresora(ultima)) return PREFERENCIAS_VACIAS;
  const papel = validarAncho(p.papel_default) ? p.papel_default : '58mm';
  return {
    version: VERSION_ACTUAL,
    ultima_impresora: ultima,
    papel_default: papel,
  };
}

async function leerPreferencias(): Promise<PreferenciasV1> {
  const raw = await AsyncStorage.getItem(KEY_PREFERENCIAS_IMPRESION);
  return parsearSeguro(raw);
}

async function escribirPreferencias(prefs: PreferenciasV1): Promise<void> {
  await AsyncStorage.setItem(
    KEY_PREFERENCIAS_IMPRESION,
    JSON.stringify(prefs),
  );
}

export async function obtenerUltimaImpresora(): Promise<Impresora | null> {
  const prefs = await leerPreferencias();
  return prefs.ultima_impresora;
}

export async function obtenerPapelDefault(): Promise<AnchoPapel> {
  const prefs = await leerPreferencias();
  return prefs.papel_default;
}

export async function guardarUltimaImpresora(
  impresora: Impresora,
): Promise<void> {
  if (!validarAncho(impresora.anchoPapel)) {
    throw new Error(
      `AnchoPapel invalido: ${String(impresora.anchoPapel)} (esperado 58mm o 80mm)`,
    );
  }
  const prefs = await leerPreferencias();
  await escribirPreferencias({
    ...prefs,
    ultima_impresora: impresora,
  });
}

export async function guardarPapelDefault(papel: AnchoPapel): Promise<void> {
  if (!validarAncho(papel)) {
    throw new Error(
      `AnchoPapel invalido: ${String(papel)} (esperado 58mm o 80mm)`,
    );
  }
  const prefs = await leerPreferencias();
  await escribirPreferencias({
    ...prefs,
    papel_default: papel,
  });
}

export async function invalidarPreferencias(): Promise<void> {
  await AsyncStorage.removeItem(KEY_PREFERENCIAS_IMPRESION);
}
