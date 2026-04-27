/**
 * Tipos del módulo AUDITORIA
 * Eventos inmutables encadenados — auditoría regulatoria CRA
 */

export interface Actor {
  readonly id: string;
  readonly rol: string;
}

// Discriminated union — Ciclo 26 inicia solo con LIQUIDACION_CREADA
// Se agregan más tipos en ciclos 31-32
export type TipoEvento =
  | 'LIQUIDACION_CREADA'
  | 'LIQUIDACION_ANULADA'
  | 'LECTURA_CAPTURADA'
  | 'EVIDENCIA_REGISTRADA'
  | 'INTEGRIDAD_VIOLADA';

export interface EventoAuditoria {
  readonly id: string;
  readonly timestamp: Date;
  readonly actor: Actor;
  readonly tipo: TipoEvento;
  readonly payload: Record<string, unknown>;
  readonly hashAnterior: string | null;
  readonly hash: string;
}

export interface RegistrarEventoInput {
  tipo: TipoEvento;
  actor: Actor;
  payload: Record<string, unknown>;
  hashAnterior?: string | null;
}

export interface ContenidoHasheable {
  id: string;
  timestamp: Date;
  actor: Actor;
  tipo: TipoEvento;
  payload: Record<string, unknown>;
  hashAnterior: string | null;
}
