/**
 * Tests del importador suscriptor+medidor.
 *
 * Politica:
 *  - Suscriptor con `codigo` ya existente: SKIP (no crear, registrar
 *    motivo 'suscriptor_duplicado'). Pero IGUAL intentar crear el
 *    medidor asociado al suscriptor existente — el CSV puede traer un
 *    medidor nuevo para un cliente ya registrado.
 *  - Medidor con `numero_medidor` ya existente: SKIP medidor.
 *  - Errores de persistencia (FK, validacion dominio): NO abortan; se
 *    acumulan y la siguiente fila se procesa.
 */

import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { bootstrapCompleto, type SistemaCompleto } from '../../composition/bootstrap-completo';
import { importarSuscriptoresYMedidores } from '../importador';
import type { FilaCSV } from '../types';

function fila(over: Partial<FilaCSV> & Pick<FilaCSV, 'linea' | 'codigo' | 'numero_medidor'>): FilaCSV {
  return {
    nombre_apellidos: 'Juan Perez',
    direccion: 'Calle 1',
    estrato: 3,
    fecha_instalacion: '2024-01-15',
    ...over,
  };
}

describe('importarSuscriptoresYMedidores', () => {
  let dir: string;
  let sis: SistemaCompleto;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sistema-import-'));
    sis = bootstrapCompleto(join(dir, 'test.db'));
  });

  afterEach(() => {
    sis.cerrar();
    rmSync(dir, { recursive: true, force: true });
  });

  it('lista vacia -> 0 creados, 0 errores, 0 saltados', async () => {
    const r = await importarSuscriptoresYMedidores([], sis.suscriptorRepo, sis.medidorRepo);
    expect(r.suscriptoresCreados).toBe(0);
    expect(r.medidoresCreados).toBe(0);
    expect(r.errores).toEqual([]);
    expect(r.saltados).toEqual([]);
  });

  it('1 fila valida -> crea 1 suscriptor + 1 medidor', async () => {
    const r = await importarSuscriptoresYMedidores(
      [fila({ linea: 2, codigo: '0001', numero_medidor: 'M-1' })],
      sis.suscriptorRepo,
      sis.medidorRepo,
    );
    expect(r.suscriptoresCreados).toBe(1);
    expect(r.medidoresCreados).toBe(1);
    expect(r.errores).toEqual([]);
    expect(r.saltados).toEqual([]);

    const sus = await sis.suscriptorRepo.buscarPorCodigo('0001');
    expect(sus).not.toBeNull();
    const med = await sis.medidorRepo.buscarPorNumero('M-1');
    expect(med?.id_suscriptor).toBe(sus!.id_suscriptor);
  });

  it('suscriptor con codigo duplicado se salta, pero crea medidor asociado al existente', async () => {
    // Sembrar suscriptor previo
    const previo = await sis.suscriptorRepo.crear({
      codigo: '0001',
      nombre_apellidos: 'Original',
      direccion: 'Vieja',
      estrato: 2,
      aplica_subsidio: false,
      estado: 'activo',
    });

    const r = await importarSuscriptoresYMedidores(
      [fila({ linea: 2, codigo: '0001', numero_medidor: 'M-NUEVO' })],
      sis.suscriptorRepo,
      sis.medidorRepo,
    );

    expect(r.suscriptoresCreados).toBe(0);
    expect(r.medidoresCreados).toBe(1);
    expect(r.saltados).toHaveLength(1);
    expect(r.saltados[0]).toEqual({
      linea: 2,
      motivo: 'suscriptor_duplicado',
      codigo: '0001',
    });

    const med = await sis.medidorRepo.buscarPorNumero('M-NUEVO');
    expect(med?.id_suscriptor).toBe(previo.id_suscriptor); // se asocia al existente
  });

  it('medidor con numero duplicado se salta (suscriptor SI se crea si es nuevo)', async () => {
    // Sembrar medidor previo (necesita un suscriptor)
    const susPrevio = await sis.suscriptorRepo.crear({
      codigo: '9999',
      nombre_apellidos: 'X',
      direccion: 'Y',
      estrato: 1,
      aplica_subsidio: false,
      estado: 'activo',
    });
    await sis.medidorRepo.crear({
      numero_medidor: 'M-DUP',
      id_suscriptor: susPrevio.id_suscriptor,
      fecha_instalacion: '2023-01-01',
      estado: 'activo',
    });

    const r = await importarSuscriptoresYMedidores(
      [fila({ linea: 2, codigo: '0001', numero_medidor: 'M-DUP' })],
      sis.suscriptorRepo,
      sis.medidorRepo,
    );

    expect(r.suscriptoresCreados).toBe(1); // suscriptor 0001 es nuevo
    expect(r.medidoresCreados).toBe(0);
    expect(r.saltados).toHaveLength(1);
    expect(r.saltados[0]).toEqual({
      linea: 2,
      motivo: 'medidor_duplicado',
      numero_medidor: 'M-DUP',
    });
  });

  it('mix: 3 filas (1 ok, 1 sus duplicado con medidor nuevo, 1 medidor duplicado)', async () => {
    // Sembrar previos
    await sis.suscriptorRepo.crear({
      codigo: '0001',
      nombre_apellidos: 'PrevioSus',
      direccion: 'X',
      estrato: 1,
      aplica_subsidio: false,
      estado: 'activo',
    });
    const susConMed = await sis.suscriptorRepo.crear({
      codigo: '9999',
      nombre_apellidos: 'X',
      direccion: 'Y',
      estrato: 1,
      aplica_subsidio: false,
      estado: 'activo',
    });
    await sis.medidorRepo.crear({
      numero_medidor: 'M-DUP',
      id_suscriptor: susConMed.id_suscriptor,
      fecha_instalacion: '2023-01-01',
      estado: 'activo',
    });

    const r = await importarSuscriptoresYMedidores(
      [
        fila({ linea: 2, codigo: '0002', numero_medidor: 'M-OK' }), // ok
        fila({ linea: 3, codigo: '0001', numero_medidor: 'M-NEW' }), // sus dup
        fila({ linea: 4, codigo: '0003', numero_medidor: 'M-DUP' }), // med dup
      ],
      sis.suscriptorRepo,
      sis.medidorRepo,
    );

    expect(r.suscriptoresCreados).toBe(2); // 0002 y 0003
    expect(r.medidoresCreados).toBe(2); // M-OK y M-NEW
    expect(r.saltados).toHaveLength(2);
    expect(r.errores).toEqual([]);
  });

  it('rechaza fila con codigo no numerico y la registra en errores', async () => {
    // El importador debe pasar la fila por la factory `crearSuscriptor` del
    // dominio antes de persistir. La factory valida `codigo` con regex
    // /^\d{1,10}$/ y tira si no matchea. Sin esta validacion previa, el
    // adapter SQLite acepta 'abc' (no hay CHECK constraint) y se cuela
    // basura a la DB — bug reportado desde mobile.
    const filaInvalida: FilaCSV = {
      linea: 2,
      codigo: 'abc',
      nombre_apellidos: 'Invalido',
      direccion: 'Calle 1',
      estrato: 3,
      numero_medidor: 'M-1',
      fecha_instalacion: '2024-01-15',
    };

    const r = await importarSuscriptoresYMedidores(
      [filaInvalida],
      sis.suscriptorRepo,
      sis.medidorRepo,
    );

    expect(r.suscriptoresCreados).toBe(0);
    expect(r.medidoresCreados).toBe(0);
    expect(r.errores).toHaveLength(1);
    expect(r.errores[0]?.linea).toBe(2);
    expect(r.errores[0]?.mensaje).toMatch(/codigo|invalido/i);

    const sus = await sis.suscriptorRepo.buscarPorCodigo('abc');
    expect(sus).toBeNull();
  });

  it('rechaza fila con numero_medidor invalido y la registra en errores', async () => {
    // Defensa simetrica al caso del codigo de suscriptor: el importador
    // debe pasar el medidor por la factory `crearMedidor`, que valida
    // `numero_medidor` con regex /^[A-Za-z0-9-]{1,50}$/. El '@' rompe.
    // El suscriptor SI se crea (la fila es valida desde el lado suscriptor);
    // solo el medidor falla y queda en `errores`.
    const filaInvalida: FilaCSV = {
      linea: 2,
      codigo: '0001',
      nombre_apellidos: 'Juan Perez',
      direccion: 'Calle 1',
      estrato: 3,
      numero_medidor: 'MED@001',
      fecha_instalacion: '2024-01-15',
    };

    const r = await importarSuscriptoresYMedidores(
      [filaInvalida],
      sis.suscriptorRepo,
      sis.medidorRepo,
    );

    expect(r.suscriptoresCreados).toBe(1);
    expect(r.medidoresCreados).toBe(0);
    expect(r.errores).toHaveLength(1);
    expect(r.errores[0]?.linea).toBe(2);
    expect(r.errores[0]?.mensaje).toMatch(/numero_medidor|invalido|admite/i);

    const med = await sis.medidorRepo.buscarPorNumero('MED@001');
    expect(med).toBeNull();
  });

  it('error de persistencia en una fila no aborta la siguiente', async () => {
    // Fila 2: estrato 9 -> CHECK constraint en DB lo rechaza
    // Fila 3: valida
    const filaInvalida: FilaCSV = {
      linea: 2,
      codigo: '0001',
      nombre_apellidos: 'X',
      direccion: 'Calle',
      estrato: 9 as 1, // bypass tipo TS, simula que el parser fallo en validar (defensivo)
      numero_medidor: 'M-1',
      fecha_instalacion: '2024-01-15',
    };

    const r = await importarSuscriptoresYMedidores(
      [filaInvalida, fila({ linea: 3, codigo: '0002', numero_medidor: 'M-2' })],
      sis.suscriptorRepo,
      sis.medidorRepo,
    );

    expect(r.suscriptoresCreados).toBe(1);
    expect(r.medidoresCreados).toBe(1);
    expect(r.errores).toHaveLength(1);
    expect(r.errores[0]?.linea).toBe(2);
  });
});
