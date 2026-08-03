// mobile/__tests__/adapters/persistir-y-encolar-alta-suscriptor.test.ts
//
// Tests del adapter `persistirYEncolarAltaSuscriptor`.
//
// Cubre la transaccion SQLite que crea SUSCRIPTOR + MEDIDOR y encola ambos:
//   1. Happy path: las cuatro escrituras confirman y MEDIDOR depende de SUSCRIPTOR.
//   2. Falla crear medidor: revierte suscriptor e item sin compensacion manual.
//   3. T-TX-5: el rollback automatico funciona aunque los deletes manuales fallen.
//   4. Falla encolar suscriptor: revierte el suscriptor y no crea medidor.
//   5. Falla crear suscriptor: no persiste ni encola nada.

import { persistirYEncolarAltaSuscriptor } from '../../src/adapters/persistir-y-encolar-alta-suscriptor';
import type { Suscriptor } from '@dominio/suscriptores/types';
import type { Medidor } from '@dominio/medidores/types';
import type { ItemCola } from '@dominio/sincronizacion/types';

// --- Fixtures ---

const BORRADOR_SUS = {
  codigo: '0042',
  nombre_apellidos: 'Test User',
  cedula: '123456789',
  municipio: 'Bogota',
  direccion: 'Calle 1',
  estrato: 2 as const,
  aplica_subsidio: false,
  id_prestador: 0,
  categoria_uso: 'residencial' as const,
  estado: 'activo' as const,
};

const BORRADOR_MED = {
  numero_medidor: 'MED-42',
  fecha_instalacion: '2024-01-01',
  estado: 'activo' as const,
};

function susCreado(id: number): Suscriptor {
  return {
    id_suscriptor: id,
    codigo: BORRADOR_SUS.codigo,
    nombre_apellidos: BORRADOR_SUS.nombre_apellidos,
    cedula: BORRADOR_SUS.cedula,
    municipio: BORRADOR_SUS.municipio,
    direccion: BORRADOR_SUS.direccion,
    estrato: BORRADOR_SUS.estrato,
    aplica_subsidio: false,
    id_prestador: 0,
    categoria_uso: 'residencial',
    estado: BORRADOR_SUS.estado,
    created_at: '2026-05-07T00:00:00.000Z',
  };
}

function medCreado(id: number, idSus: number): Medidor {
  return {
    id_medidor: id,
    numero_medidor: BORRADOR_MED.numero_medidor,
    id_suscriptor: idSus,
    fecha_instalacion: BORRADOR_MED.fecha_instalacion,
    estado: BORRADOR_MED.estado,
    created_at: '2026-05-07T00:00:00.000Z',
  };
}

function setup() {
  const suscriptoresPersistidos: Suscriptor[] = [];
  const medidoresPersistidos: Medidor[] = [];
  const itemsGuardados: ItemCola[] = [];

  const withTransactionAsync = jest.fn(async (task: () => Promise<void>): Promise<void> => {
    const snapshot = {
      suscriptores: [...suscriptoresPersistidos],
      medidores: [...medidoresPersistidos],
      items: [...itemsGuardados],
    };
    try {
      await task();
    } catch (error) {
      suscriptoresPersistidos.splice(0, suscriptoresPersistidos.length, ...snapshot.suscriptores);
      medidoresPersistidos.splice(0, medidoresPersistidos.length, ...snapshot.medidores);
      itemsGuardados.splice(0, itemsGuardados.length, ...snapshot.items);
      throw error;
    }
  });

  return {
    suscriptorRepo: {
      withTransactionAsync,
      crear: jest.fn(),
      eliminar: jest.fn(),
    },
    medidorRepo: {
      crear: jest.fn(),
    },
    colaRepo: {
      guardar: jest.fn(async (it: ItemCola) => {
        itemsGuardados.push(it);
      }),
      eliminar: jest.fn(),
    },
    idGenerator: (() => {
      let n = 0;
      return { uuid: jest.fn(() => `uuid-${++n}`) };
    })(),
    hasher: { sha256: jest.fn(() => 'hash-fake') },
    withTransactionAsync,
    suscriptoresPersistidos,
    medidoresPersistidos,
    itemsGuardados,
  };
}

describe('persistirYEncolarAltaSuscriptor', () => {
  it('happy_path_persiste_y_encola_ambos_con_dependeDe', async () => {
    const s = setup();
    s.suscriptorRepo.crear.mockResolvedValue(susCreado(7));
    s.medidorRepo.crear.mockResolvedValue(medCreado(70, 7));

    const out = await persistirYEncolarAltaSuscriptor({
      borradorSuscriptor: BORRADOR_SUS,
      borradorMedidor: BORRADOR_MED,
      suscriptorRepo: s.suscriptorRepo,
      medidorRepo: s.medidorRepo,
      colaRepo: s.colaRepo,
      idGenerator: s.idGenerator,
      hasher: s.hasher,
    });

    expect(out.suscriptor.id_suscriptor).toBe(7);
    expect(out.medidor.id_medidor).toBe(70);

    expect(s.itemsGuardados).toHaveLength(2);
    const [itSus, itMed] = s.itemsGuardados;
    expect(itSus.tipo).toBe('SUSCRIPTOR');
    expect(itMed.tipo).toBe('MEDIDOR');
    expect(itMed.dependeDe).toEqual([itSus.id]);

    expect(s.suscriptorRepo.eliminar).not.toHaveBeenCalled();
    expect(s.colaRepo.eliminar).not.toHaveBeenCalled();
  });

  it('falla_medidor_revierte_suscriptor_e_item_sin_compensacion_manual', async () => {
    const s = setup();
    s.suscriptorRepo.crear.mockResolvedValue(susCreado(8));
    s.medidorRepo.crear.mockRejectedValue(new Error('UK violada'));

    await expect(
      persistirYEncolarAltaSuscriptor({
        borradorSuscriptor: BORRADOR_SUS,
        borradorMedidor: BORRADOR_MED,
        suscriptorRepo: s.suscriptorRepo,
        medidorRepo: s.medidorRepo,
        colaRepo: s.colaRepo,
        idGenerator: s.idGenerator,
        hasher: s.hasher,
      }),
    ).rejects.toThrow('UK violada');

    expect(s.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(s.itemsGuardados).toEqual([]);
    expect(s.suscriptorRepo.eliminar).not.toHaveBeenCalled();
    expect(s.colaRepo.eliminar).not.toHaveBeenCalled();
  });

  it('T-TX-5 si crear medidor falla, SQLite revierte el suscriptor aunque el rollback manual no exista', async () => {
    const s = setup();
    const suscriptor = susCreado(81);
    const errorMedidor = new Error('medidor write failed');
    s.suscriptorRepo.crear.mockImplementation(async () => {
      s.suscriptoresPersistidos.push(suscriptor);
      return suscriptor;
    });
    s.medidorRepo.crear.mockRejectedValue(errorMedidor);
    s.suscriptorRepo.eliminar.mockRejectedValue(new Error('rollback manual suscriptor'));
    s.colaRepo.eliminar.mockRejectedValue(new Error('rollback manual cola'));

    await expect(
      persistirYEncolarAltaSuscriptor({
        borradorSuscriptor: BORRADOR_SUS,
        borradorMedidor: BORRADOR_MED,
        suscriptorRepo: s.suscriptorRepo,
        medidorRepo: s.medidorRepo,
        colaRepo: s.colaRepo,
        idGenerator: s.idGenerator,
        hasher: s.hasher,
      }),
    ).rejects.toBe(errorMedidor);

    expect(s.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(s.suscriptoresPersistidos).toEqual([]);
    expect(s.itemsGuardados).toEqual([]);
    expect(s.suscriptorRepo.eliminar).not.toHaveBeenCalled();
    expect(s.colaRepo.eliminar).not.toHaveBeenCalled();
  });

  it('falla_encolar_suscriptor_revierte_el_suscriptor_y_no_crea_medidor', async () => {
    const s = setup();
    const suscriptor = susCreado(9);
    const errorCola = new Error('cola no disponible');
    s.suscriptorRepo.crear.mockImplementation(async () => {
      s.suscriptoresPersistidos.push(suscriptor);
      return suscriptor;
    });
    s.colaRepo.guardar.mockRejectedValue(errorCola);

    await expect(
      persistirYEncolarAltaSuscriptor({
        borradorSuscriptor: BORRADOR_SUS,
        borradorMedidor: BORRADOR_MED,
        suscriptorRepo: s.suscriptorRepo,
        medidorRepo: s.medidorRepo,
        colaRepo: s.colaRepo,
        idGenerator: s.idGenerator,
        hasher: s.hasher,
      }),
    ).rejects.toBe(errorCola);

    expect(s.suscriptoresPersistidos).toEqual([]);
    expect(s.medidorRepo.crear).not.toHaveBeenCalled();
    expect(s.suscriptorRepo.eliminar).not.toHaveBeenCalled();
    expect(s.colaRepo.eliminar).not.toHaveBeenCalled();
  });

  it('falla_crear_suscriptor_no_persiste_ni_encola_nada', async () => {
    const s = setup();
    s.suscriptorRepo.crear.mockRejectedValue(new Error('codigo duplicado'));

    await expect(
      persistirYEncolarAltaSuscriptor({
        borradorSuscriptor: BORRADOR_SUS,
        borradorMedidor: BORRADOR_MED,
        suscriptorRepo: s.suscriptorRepo,
        medidorRepo: s.medidorRepo,
        colaRepo: s.colaRepo,
        idGenerator: s.idGenerator,
        hasher: s.hasher,
      }),
    ).rejects.toThrow('codigo duplicado');

    expect(s.medidorRepo.crear).not.toHaveBeenCalled();
    expect(s.colaRepo.guardar).not.toHaveBeenCalled();
    expect(s.colaRepo.eliminar).not.toHaveBeenCalled();
    expect(s.suscriptorRepo.eliminar).not.toHaveBeenCalled();
  });
});
