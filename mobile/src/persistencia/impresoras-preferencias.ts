/**
 * Wrapper AsyncStorage para preferencias de impresora Bluetooth.
 *
 * Implementacion real llega en commit 9/10 (ver proposal R5). Este
 * stub existe para que otros modulos (factory, FacturaPreviewScreen)
 * puedan importarlo y los tests mockearlo sin errores de resolucion.
 *
 * Spec: `impresora-perfil-preferences` REQ 1-5.
 */

import type { AnchoPapel } from '@dominio/impresion';
import type { Impresora } from '@dominio/impresion';

export async function obtenerUltimaImpresora(): Promise<Impresora | null> {
  return null;
}

export async function obtenerPapelDefault(): Promise<AnchoPapel> {
  return '58mm';
}

export async function guardarUltimaImpresora(_impresora: Impresora): Promise<void> {
  // noop
}

export async function guardarPapelDefault(_papel: AnchoPapel): Promise<void> {
  // noop
}

export async function invalidarPreferencias(): Promise<void> {
  // noop
}
