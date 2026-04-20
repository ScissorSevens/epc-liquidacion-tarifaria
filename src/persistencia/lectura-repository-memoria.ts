import { Lectura } from '../captura-lecturas/types';
import { LecturaRepository, FiltrosLectura } from './lectura-repository';

/**
 * Implementación en memoria del repositorio de lecturas
 * Para tests y desarrollo. En producción se reemplaza por SQLiteRepository.
 */
export class LecturaRepositoryMemoria implements LecturaRepository {
  private lecturas: Lectura[] = [];
  private nextId = 1;

  async guardar(lectura: Lectura): Promise<Lectura> {
    // Validar clave única compuesta (id_medidor, id_periodo)
    const existe = this.lecturas.some(
      l => l.id_medidor === lectura.id_medidor && l.id_periodo === lectura.id_periodo,
    );
    if (existe) {
      throw new Error(
        `Ya existe una lectura para el medidor ${lectura.id_medidor} en el periodo ${lectura.id_periodo}`,
      );
    }

    const nueva: Lectura = { ...lectura, id_lectura: this.nextId++ };
    this.lecturas.push(nueva);
    return { ...nueva };
  }

  async obtenerPorId(id: number): Promise<Lectura | null> {
    const lectura = this.lecturas.find(l => l.id_lectura === id);
    return lectura ? { ...lectura } : null;
  }

  async listarPorPeriodo(idPeriodo: string): Promise<Lectura[]> {
    return this.lecturas
      .filter(l => l.id_periodo === idPeriodo)
      .map(l => ({ ...l }));
  }

  async listarPendientesSync(): Promise<Lectura[]> {
    return this.lecturas
      .filter(l => l.estado_sync === 'pendiente')
      .map(l => ({ ...l }));
  }

  async listar(filtros?: FiltrosLectura): Promise<Lectura[]> {
    let resultado = [...this.lecturas];

    if (filtros) {
      if (filtros.id_periodo !== undefined) {
        resultado = resultado.filter(l => l.id_periodo === filtros.id_periodo);
      }
      if (filtros.id_medidor !== undefined) {
        resultado = resultado.filter(l => l.id_medidor === filtros.id_medidor);
      }
      if (filtros.id_operario !== undefined) {
        resultado = resultado.filter(l => l.id_operario === filtros.id_operario);
      }
      if (filtros.estado_sync !== undefined) {
        resultado = resultado.filter(l => l.estado_sync === filtros.estado_sync);
      }
      if (filtros.estado_validacion !== undefined) {
        resultado = resultado.filter(l => l.estado_validacion === filtros.estado_validacion);
      }
    }

    return resultado.map(l => ({ ...l }));
  }

  async actualizarEstadoSync(
    id: number,
    estado: 'sincronizado' | 'error',
    timestampSync?: string,
  ): Promise<Lectura> {
    const lectura = this.lecturas.find(l => l.id_lectura === id);
    if (!lectura) {
      throw new Error(`Lectura con id ${id} no encontrada`);
    }

    lectura.estado_sync = estado;
    if (timestampSync) {
      lectura.timestamp_sync = timestampSync;
    }

    return { ...lectura };
  }

  async actualizarEstadoValidacion(
    id: number,
    estado: 'validado' | 'error',
  ): Promise<Lectura> {
    const lectura = this.lecturas.find(l => l.id_lectura === id);
    if (!lectura) {
      throw new Error(`Lectura con id ${id} no encontrada`);
    }

    lectura.estado_validacion = estado;
    return { ...lectura };
  }

  async contar(filtros?: FiltrosLectura): Promise<number> {
    const resultado = await this.listar(filtros);
    return resultado.length;
  }

  async existeLectura(idMedidor: number, idPeriodo: string): Promise<boolean> {
    return this.lecturas.some(
      l => l.id_medidor === idMedidor && l.id_periodo === idPeriodo,
    );
  }
}
