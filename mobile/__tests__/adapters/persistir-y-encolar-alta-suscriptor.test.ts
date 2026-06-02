// mobile/__tests__/adapters/persistir-y-encolar-alta-suscriptor.test.ts
//
// Tests del adapter `persistirYEncolarAltaSuscriptor`.
//
// Reemplaza la logica inline de la pantalla `AltaSuscriptor.tsx`:
// crea SUSCRIPTOR + MEDIDOR en SQLite local, encola ambos para sync
// con `dependeDe` correcto, y compensa si algo del medidor falla.
//
// Casos cubiertos:
//   1. Happy path: ambos creados → 2 items encolados, MEDIDOR depende
//      de SUSCRIPTOR.
//   2. Falla crear medidor → eliminar suscriptor de SQLite + eliminar
//      item SUSCRIPTOR de cola. Adapter relanza el error.
//   3. Falla crear medidor + falla `suscriptorRepo.eliminar` →
//      adapter relanza el error original del medidor PERO igual intenta
//      eliminar el item de cola (best effort).
//   4. Falla crear suscriptor → no se persiste nada, no se encola nada,
//      adapter relanza.

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
  const itemsGuardados: ItemCola[] = [];
  const itemsEliminados: string[] = [];

  return {
    suscriptorRepo: {
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
      eliminar: jest.fn(async (id: string) => {
        itemsEliminados.push(id);
      }),
    },
    idGenerator: (() => {
      let n = 0;
      return { uuid: jest.fn(() => `uuid-${++n}`) };
    })(),
    hasher: { sha256: jest.fn(() => 'hash-fake') },
    itemsGuardados,
    itemsEliminados,
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

  it('falla_medidor_revierte_suscriptor_y_borra_item_cola', async () => {
    const s = setup();
    s.suscriptorRepo.crear.mockResolvedValue(susCreado(8));
    s.medidorRepo.crear.mockRejectedValue(new Error('UK violada'));
    s.suscriptorRepo.eliminar.mockResolvedValue(undefined);

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

    expect(s.suscriptorRepo.eliminar).toHaveBeenCalledWith(8);
    // El item SUSCRIPTOR que llegamos a encolar debe borrarse.
    const itSusGuardado = s.itemsGuardados.find((i) => i.tipo === 'SUSCRIPTOR');
    expect(itSusGuardado).toBeDefined();
    expect(s.colaRepo.eliminar).toHaveBeenCalledWith(itSusGuardado!.id);
    // No debe haberse encolado MEDIDOR.
    expect(s.itemsGuardados.find((i) => i.tipo === 'MEDIDOR')).toBeUndefined();
  });

  it('falla_medidor_y_falla_eliminar_suscriptor_igual_intenta_borrar_item_cola_y_relanza', async () => {
    const s = setup();
    s.suscriptorRepo.crear.mockResolvedValue(susCreado(9));
    s.medidorRepo.crear.mockRejectedValue(new Error('FK invalida'));
    s.suscriptorRepo.eliminar.mockRejectedValue(new Error('eliminar stub'));

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
    ).rejects.toThrow('FK invalida');

    // Best effort: ambas compensaciones se intentan.
    expect(s.suscriptorRepo.eliminar).toHaveBeenCalledWith(9);
    const itSusGuardado = s.itemsGuardados.find((i) => i.tipo === 'SUSCRIPTOR');
    expect(s.colaRepo.eliminar).toHaveBeenCalledWith(itSusGuardado!.id);
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
