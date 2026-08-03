import type { Factura } from './types';

export interface SharingSharePort {
  isAvailableAsync(): Promise<boolean>;
  shareAsync(
    uri: string,
    options: { mimeType: string; dialogTitle: string },
  ): Promise<void>;
}

export interface FileSystemSharePort {
  readonly cacheDirectory?: string | null;
  writeAsStringAsync(uri: string, contents: string): Promise<void>;
}

export interface OpcionesTextoCompartir {
  /** Payload del tiquete, aceptado para compatibilidad; el formato normativo se deriva de Factura. */
  readonly ticket?: readonly string[];
  readonly incluirTitulo?: boolean;
}

export type CodigoErrorCompartir =
  | 'SHARE_UNAVAILABLE'
  | 'SHARE_FAILED'
  | 'SHARE_CANCELLED';

export class ErrorCompartirFactura extends Error {
  readonly code: CodigoErrorCompartir;

  constructor(code: CodigoErrorCompartir, message: string) {
    super(message);
    this.name = 'ErrorCompartirFactura';
    this.code = code;
  }
}

function monto(value: number | undefined): string {
  return String(value ?? 0);
}

function texto(value: string | number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function facturaDesdeArgumentos(
  facturaOrTicket: Factura | readonly string[],
  opcionesOrFactura?: OpcionesTextoCompartir | Factura,
): { factura: Factura; opciones: OpcionesTextoCompartir } {
  if (Array.isArray(facturaOrTicket)) {
    return {
      factura: opcionesOrFactura as Factura,
      opciones: { ticket: facturaOrTicket },
    };
  }
  return {
    factura: facturaOrTicket as Factura,
    opciones: (opcionesOrFactura as OpcionesTextoCompartir | undefined) ?? {},
  };
}

/**
 * Arma el documento plano que se comparte. No serializa el aggregate: sólo
 * proyecta los campos normativos permitidos por el contrato de share.
 */
export function armarTextoCompartir(
  factura: Factura,
  opciones?: OpcionesTextoCompartir,
): string;
export function armarTextoCompartir(
  ticket: readonly string[],
  factura: Factura,
): string;
export function armarTextoCompartir(
  facturaOrTicket: Factura | readonly string[],
  opcionesOrFactura?: OpcionesTextoCompartir | Factura,
): string {
  const { factura, opciones } = facturaDesdeArgumentos(facturaOrTicket, opcionesOrFactura);
  const snapshot = factura.snapshot;
  const resultado = snapshot.liquidacion.resultado;
  const lineas: string[] = [];

  if (opciones.incluirTitulo !== false) lineas.push('FACTURA DE SERVICIO PUBLICO');
  lineas.push(
    `Prestador: ${texto(snapshot.prestador.nombre)}`,
    `NIT: ${texto(snapshot.prestador.nit)}`,
    `Municipio: ${texto(snapshot.prestador.municipio)}`,
    `Departamento: ${texto(snapshot.prestador.departamento)}`,
    `Código: ${texto(snapshot.suscriptor.codigo)}`,
    `Suscriptor: ${texto(snapshot.suscriptor.nombre_apellidos)}`,
    `Cédula: ${texto(snapshot.suscriptor.cedula)}`,
    `Dirección: ${texto(snapshot.suscriptor.direccion)}`,
    `Medidor: ${texto(snapshot.medidor.numero_medidor)}`,
    `Periodo: ${texto(snapshot.periodo.id_periodo)}`,
    `Lectura actual: ${monto(snapshot.lectura.lectura_actual)}`,
    `Lectura anterior: ${monto(snapshot.lectura.lectura_anterior)}`,
    `Consumo m3: ${monto(resultado.consumo_m3)}`,
    `Liquidación: ${monto(resultado.total)}`,
  );

  for (const otro of snapshot.otros_valores) {
    lineas.push(`${texto(otro.concepto)}: ${monto(otro.valor)}`);
  }
  lineas.push(
    `Saldo anterior: ${monto(snapshot.saldo_anterior)}`,
    `Total: ${monto(resultado.total + snapshot.otros_valores.reduce((sum, item) => sum + item.valor, 0) + snapshot.saldo_anterior)}`,
    `Cod. Verificación: ${texto(factura.codigo_verificacion)}`,
    `Referencia: ${texto(factura.referencia_pago)}`,
  );

  return `${lineas.join('\n')}\n`;
}

function cargarPorts(): {
  sharing: SharingSharePort;
  fileSystem: FileSystemSharePort;
} {
  // Legacy es el entry point soportado por Expo SDK 54 para
  // writeAsStringAsync/cacheDirectory. El require lazy mantiene el dominio
  // importable en Jest y en entornos que no tienen módulos nativos.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sharing = require('expo-sharing') as SharingSharePort;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fileSystem = require('expo-file-system/legacy') as FileSystemSharePort;
  return { sharing, fileSystem };
}

function esCancelacion(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /cancel(?:ed|led|ation)?|user\s+canceled|user\s+cancelled/i.test(message);
}

function errorMensaje(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function uriTemporal(fileSystem: FileSystemSharePort, factura: Factura): string {
  const directory = fileSystem.cacheDirectory;
  if (typeof directory !== 'string' || directory.length === 0) {
    throw new ErrorCompartirFactura(
      'SHARE_UNAVAILABLE',
      'No hay un directorio temporal disponible para compartir',
    );
  }
  const base = directory.endsWith('/') ? directory : `${directory}/`;
  const idSeguro = factura.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${base}factura-${idSeguro}.txt`;
}

export async function compartirFactura(
  factura: Factura,
  sharing?: SharingSharePort,
  fileSystem?: FileSystemSharePort,
): Promise<boolean>;
export async function compartirFactura(
  ticket: readonly string[],
  factura: Factura,
  sharing?: SharingSharePort,
  fileSystem?: FileSystemSharePort,
): Promise<boolean>;
export async function compartirFactura(
  facturaOrTicket: Factura | readonly string[],
  facturaOrSharing?: Factura | SharingSharePort,
  sharingOrFileSystem?: SharingSharePort | FileSystemSharePort,
  explicitFileSystem?: FileSystemSharePort,
): Promise<boolean> {
  let factura: Factura;
  let sharing: SharingSharePort | undefined;
  let fileSystem: FileSystemSharePort | undefined;

  if (Array.isArray(facturaOrTicket)) {
    factura = facturaOrSharing as Factura;
    sharing = sharingOrFileSystem as SharingSharePort | undefined;
    fileSystem = explicitFileSystem;
  } else {
    factura = facturaOrTicket as Factura;
    sharing = facturaOrSharing as SharingSharePort | undefined;
    fileSystem = sharingOrFileSystem as FileSystemSharePort | undefined;
  }

  const ports =
    sharing !== undefined && fileSystem !== undefined
      ? { sharing, fileSystem }
      : cargarPorts();
  const disponible = await ports.sharing.isAvailableAsync();
  if (!disponible) {
    throw new ErrorCompartirFactura('SHARE_UNAVAILABLE', 'No hay apps para compartir');
  }

  const uri = uriTemporal(ports.fileSystem, factura);
  const contenido = armarTextoCompartir(factura);
  await ports.fileSystem.writeAsStringAsync(uri, contenido);
  try {
    await ports.sharing.shareAsync(uri, {
      mimeType: 'text/plain',
      dialogTitle: 'Compartir factura',
    });
    return true;
  } catch (error) {
    if (esCancelacion(error)) return false;
    throw new ErrorCompartirFactura(
      'SHARE_FAILED',
      `No se pudo abrir el selector para compartir: ${errorMensaje(error)}`,
    );
  }
}
