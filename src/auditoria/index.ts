export {
  registrarEvento,
  registrarLiquidacionCreada,
  registrarLiquidacionAnulada,
  registrarLecturaCapturada,
  registrarEvidenciaRegistrada,
  registrarIntegridadViolada,
  calcularHash,
  verificarCadena,
} from './auditoria';
export type { ResultadoVerificacion, RazonInvalidez } from './auditoria';
export type {
  EventoAuditoria,
  RegistrarEventoInput,
  RegistrarTipadoInput,
  ContenidoHasheable,
  TipoEvento,
  Actor,
  PayloadLiquidacionCreada,
  PayloadLiquidacionAnulada,
  PayloadLecturaCapturada,
  PayloadEvidenciaRegistrada,
  PayloadIntegridadViolada,
} from './types';
