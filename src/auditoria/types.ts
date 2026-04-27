/**
 * Tipos del módulo AUDITORIA
 * Eventos inmutables encadenados — auditoría regulatoria CRA
 */

export interface Actor {
  readonly id: string;
  readonly rol: string;
}

// Discriminated union — payloads tipados por evento
export interface PayloadLiquidacionCreada {
  liquidacionId: string;
  total: number;
}

export interface PayloadLiquidacionAnulada {
  liquidacionAnuladaId: string;
  liquidacionNuevaId: string;
  motivo: string;
}

export interface PayloadLecturaCapturada {
  suscriptorId: string;
  lecturaActual: number;
  fechaLectura: Date;
}

export interface PayloadEvidenciaRegistrada {
  suscriptorId: string;
  hashFoto: string;
  gps?: { lat: number; lng: number };
}

export interface PayloadIntegridadViolada {
  entidadTipo: string;
  entidadId: string;
  hashEsperado: string;
  hashRecibido: string;
}

// Base común a todos los eventos — campos de infraestructura
interface EventoBase {
  readonly id: string;
  readonly timestamp: Date;
  readonly actor: Actor;
  readonly hashAnterior: string | null;
  readonly hash: string;
}

// Discriminated union — el campo `tipo` discrimina el shape de `payload`
export type EventoAuditoria =
  | (EventoBase & { readonly tipo: 'LIQUIDACION_CREADA'; readonly payload: PayloadLiquidacionCreada })
  | (EventoBase & { readonly tipo: 'LIQUIDACION_ANULADA'; readonly payload: PayloadLiquidacionAnulada })
  | (EventoBase & { readonly tipo: 'LECTURA_CAPTURADA'; readonly payload: PayloadLecturaCapturada })
  | (EventoBase & { readonly tipo: 'EVIDENCIA_REGISTRADA'; readonly payload: PayloadEvidenciaRegistrada })
  | (EventoBase & { readonly tipo: 'INTEGRIDAD_VIOLADA'; readonly payload: PayloadIntegridadViolada });

export type TipoEvento = EventoAuditoria['tipo'];

// Input genérico interno (lo usan los constructores específicos)
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

// Inputs públicos por tipo (type-safe)
export interface RegistrarTipadoInput<P> {
  actor: Actor;
  payload: P;
  hashAnterior?: string | null;
}
