/**
 * Boundary de UI para compartir facturas. La transformación normativa vive en
 * dominio y los módulos Expo se cargan de forma lazy dentro del servicio.
 */
export {
  armarTextoCompartir,
  compartirFactura,
  ErrorCompartirFactura,
} from '../../dominio/factura/compartir-factura';
export type {
  CodigoErrorCompartir,
  FileSystemSharePort,
  OpcionesTextoCompartir,
  SharingSharePort,
} from '../../dominio/factura/compartir-factura';
