import type {
  ActualizarPeriodoInput,
  Periodo,
  PeriodoBorrador,
  PeriodoRepository,
} from '../../dominio/periodos/types';
import type { Liquidacion } from '../../dominio/calculo/types';
import type { ConsumoHistorico } from '../../dominio/factura/types';

/**
 * Repositorios de contexto usados por la emisión móvil.
 *
 * La app móvil todavía no replica las tablas de períodos, liquidaciones e
 * históricos en SQLite. Estos stores viven en el composition root y duran lo
 * mismo que el bootstrap cacheado; la captura registra el contexto calculado
 * antes de emitir la factura. Cuando esas tablas se incorporen, estas
 * interfaces permiten reemplazar el backing store sin tocar el servicio.
 */

export interface LiquidacionRepositoryMovil {
  crear(liquidacion: Liquidacion): Promise<Liquidacion>;
  guardar(liquidacion: Liquidacion): Promise<Liquidacion>;
  buscarPorId(id: string): Promise<Liquidacion | null>;
  listar(): Promise<readonly Liquidacion[]>;
  actualizar(
    id: string,
    cambios: Partial<Pick<Liquidacion, 'resultado' | 'estado' | 'hash' | 'reemplazaA'>>,
  ): Promise<Liquidacion>;
  eliminar(id: string): Promise<void>;
}

export interface ConsumoHistoricoPersistido extends ConsumoHistorico {
  readonly id_consumo: string;
  readonly id_suscriptor: number;
}

export interface ConsumoHistoricoRepositoryMovil {
  crear(
    data:
      | ConsumoHistoricoPersistido
      | { readonly id_suscriptor: number; readonly consumo: ConsumoHistorico },
  ): Promise<ConsumoHistoricoPersistido>;
  guardar(
    id_suscriptor: number,
    consumo: ConsumoHistorico,
  ): Promise<ConsumoHistoricoPersistido>;
  guardar(data: ConsumoHistoricoPersistido): Promise<ConsumoHistoricoPersistido>;
  buscarPorId(id: string): Promise<ConsumoHistoricoPersistido | null>;
  listar(): Promise<readonly ConsumoHistoricoPersistido[]>;
  listarPorSuscriptor(id_suscriptor: number): Promise<readonly ConsumoHistorico[]>;
  actualizar(
    id: string,
    cambios: Partial<Pick<ConsumoHistorico, 'consumo_m3' | 'total_facturado'>>,
  ): Promise<ConsumoHistoricoPersistido>;
  eliminar(id: string): Promise<void>;
}

export interface RepositoriosEmision {
  readonly periodoRepo: PeriodoRepository & {
    guardar(periodo: Periodo): Promise<Periodo>;
    cerrar(): Promise<void>;
  };
  readonly liquidacionRepo: LiquidacionRepositoryMovil & {
    cerrar(): Promise<void>;
  };
  readonly consumoHistoricoRepo: ConsumoHistoricoRepositoryMovil & {
    cerrar(): Promise<void>;
  };
}

function crearPeriodoRepo(): RepositoriosEmision['periodoRepo'] {
  const store = new Map<string, Periodo>();
  return {
    async crear(data: PeriodoBorrador): Promise<Periodo> {
      const periodo: Periodo = {
        ...data,
        created_at: new Date().toISOString(),
      };
      store.set(periodo.id_periodo, periodo);
      return periodo;
    },
    async guardar(periodo: Periodo): Promise<Periodo> {
      store.set(periodo.id_periodo, periodo);
      return periodo;
    },
    async buscarPorId(id: string): Promise<Periodo | null> {
      return store.get(id) ?? null;
    },
    async listar(): Promise<Periodo[]> {
      return Array.from(store.values());
    },
    async actualizar(id: string, cambios: ActualizarPeriodoInput): Promise<Periodo> {
      const actual = store.get(id);
      if (!actual) throw new Error(`Periodo ${id} no encontrado`);
      const actualizado: Periodo = { ...actual, ...cambios };
      store.set(id, actualizado);
      return actualizado;
    },
    async eliminar(id: string): Promise<void> {
      store.delete(id);
    },
    async cerrar(): Promise<void> {
      store.clear();
    },
  };
}

function crearLiquidacionRepo(): RepositoriosEmision['liquidacionRepo'] {
  const store = new Map<string, Liquidacion>();
  return {
    async crear(liquidacion: Liquidacion): Promise<Liquidacion> {
      store.set(liquidacion.id, liquidacion);
      return liquidacion;
    },
    async guardar(liquidacion: Liquidacion): Promise<Liquidacion> {
      store.set(liquidacion.id, liquidacion);
      return liquidacion;
    },
    async buscarPorId(id: string): Promise<Liquidacion | null> {
      return store.get(id) ?? null;
    },
    async listar(): Promise<readonly Liquidacion[]> {
      return Array.from(store.values());
    },
    async actualizar(
      id: string,
      cambios: Partial<Pick<Liquidacion, 'resultado' | 'estado' | 'hash' | 'reemplazaA'>>,
    ): Promise<Liquidacion> {
      const actual = store.get(id);
      if (!actual) throw new Error(`Liquidacion ${id} no encontrada`);
      const actualizado: Liquidacion = { ...actual, ...cambios };
      store.set(id, actualizado);
      return actualizado;
    },
    async eliminar(id: string): Promise<void> {
      store.delete(id);
    },
    async cerrar(): Promise<void> {
      store.clear();
    },
  };
}

function crearConsumoHistoricoRepo(): RepositoriosEmision['consumoHistoricoRepo'] {
  const store = new Map<string, ConsumoHistoricoPersistido>();
  let secuencia = 0;

  function normalizar(
    data:
      | ConsumoHistoricoPersistido
      | { readonly id_suscriptor: number; readonly consumo: ConsumoHistorico },
  ): ConsumoHistoricoPersistido {
    if ('id_consumo' in data) return data;
    return {
      id_consumo: `consumo-${++secuencia}`,
      id_suscriptor: data.id_suscriptor,
      ...data.consumo,
    };
  }

  return {
    async crear(data): Promise<ConsumoHistoricoPersistido> {
      const consumo = normalizar(data);
      store.set(consumo.id_consumo, consumo);
      return consumo;
    },
    async guardar(
      idOrData: number | ConsumoHistoricoPersistido,
      consumo?: ConsumoHistorico,
    ): Promise<ConsumoHistoricoPersistido> {
      const data =
        typeof idOrData === 'number'
          ? { id_suscriptor: idOrData, consumo: consumo as ConsumoHistorico }
          : idOrData;
      const persistido = normalizar(data);
      store.set(persistido.id_consumo, persistido);
      return persistido;
    },
    async buscarPorId(id: string): Promise<ConsumoHistoricoPersistido | null> {
      return store.get(id) ?? null;
    },
    async listar(): Promise<readonly ConsumoHistoricoPersistido[]> {
      return Array.from(store.values());
    },
    async listarPorSuscriptor(id_suscriptor: number): Promise<readonly ConsumoHistorico[]> {
      return Array.from(store.values()).filter((c) => c.id_suscriptor === id_suscriptor);
    },
    async actualizar(
      id: string,
      cambios: Partial<Pick<ConsumoHistorico, 'consumo_m3' | 'total_facturado'>>,
    ): Promise<ConsumoHistoricoPersistido> {
      const actual = store.get(id);
      if (!actual) throw new Error(`Consumo historico ${id} no encontrado`);
      const actualizado: ConsumoHistoricoPersistido = { ...actual, ...cambios };
      store.set(id, actualizado);
      return actualizado;
    },
    async eliminar(id: string): Promise<void> {
      store.delete(id);
    },
    async cerrar(): Promise<void> {
      store.clear();
    },
  };
}

export function crearRepositoriosEmision(): RepositoriosEmision {
  return {
    periodoRepo: crearPeriodoRepo(),
    liquidacionRepo: crearLiquidacionRepo(),
    consumoHistoricoRepo: crearConsumoHistoricoRepo(),
  };
}
