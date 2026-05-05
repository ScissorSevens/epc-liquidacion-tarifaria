/**
 * Tests del bootstrap completo (composition root SQLite + utilitarios).
 *
 * Verifica que el caller obtiene 5 repositorios cableados + Hasher +
 * IdGenerator + cerrar(), y que la integracion mas critica funciona:
 * crear suscriptor + crear medidor con FK valida + recuperar ambos.
 *
 * NO testeamos detalle de cada repo (eso ya esta en sus tests propios).
 */

import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { bootstrapCompleto } from '../bootstrap-completo';

describe('bootstrapCompleto', () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sistema-bootstrap-'));
    dbPath = join(dir, 'test.db');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('devuelve los 5 repos + hasher + idGen + cerrar', () => {
    const sis = bootstrapCompleto(dbPath);
    try {
      expect(sis.facturaRepo).toBeDefined();
      expect(sis.lecturaRepo).toBeDefined();
      expect(sis.colaRepo).toBeDefined();
      expect(sis.suscriptorRepo).toBeDefined();
      expect(sis.medidorRepo).toBeDefined();
      expect(sis.hasher).toBeDefined();
      expect(typeof sis.hasher.sha256).toBe('function');
      expect(sis.idGen).toBeDefined();
      expect(typeof sis.idGen.uuid).toBe('function');
      expect(typeof sis.cerrar).toBe('function');
    } finally {
      sis.cerrar();
    }
  });

  it('flujo end-to-end: crear suscriptor + medidor con FK valida + recuperar', async () => {
    const sis = bootstrapCompleto(dbPath);
    try {
      const sus = await sis.suscriptorRepo.crear({
        codigo: '0042',
        nombre_apellidos: 'Juana Perez',
        direccion: 'Av Siempreviva 742',
        estrato: 3,
        estado: 'activo',
      });
      const med = await sis.medidorRepo.crear({
        numero_medidor: 'M-001',
        id_suscriptor: sus.id_suscriptor,
        fecha_instalacion: '2024-01-15',
        estado: 'activo',
      });

      expect(med.id_suscriptor).toBe(sus.id_suscriptor);

      const recSus = await sis.suscriptorRepo.buscarPorId(sus.id_suscriptor);
      const recMed = await sis.medidorRepo.buscarPorId(med.id_medidor);
      expect(recSus).toEqual(sus);
      expect(recMed).toEqual(med);

      const medsDelSus = await sis.medidorRepo.listarPorSuscriptor(sus.id_suscriptor);
      expect(medsDelSus).toEqual([med]);
    } finally {
      sis.cerrar();
    }
  });

  it('rechaza FK invalida (PRAGMA foreign_keys ON activo)', async () => {
    const sis = bootstrapCompleto(dbPath);
    try {
      await expect(
        sis.medidorRepo.crear({
          numero_medidor: 'M-X',
          id_suscriptor: 9999,
          fecha_instalacion: '2024-01-01',
          estado: 'activo',
        }),
      ).rejects.toThrow(/suscriptor 9999/i);
    } finally {
      sis.cerrar();
    }
  });
});
