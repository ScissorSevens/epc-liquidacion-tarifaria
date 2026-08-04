import {
  armarTextoCompartir,
  compartirFactura,
  type FileSystemSharePort,
  type SharingSharePort,
} from '../compartir-factura';
import type { Factura } from '../types';

function crearFactura(): Factura {
  return {
    id: 'factura-share-1',
    numero_factura: 'MZ-001-7',
    estado: 'EMITIDA',
    fecha_emision: '2026-02-01',
    snapshot: {
      prestador: {
        id_prestador: 1,
        codigo: 'P-1',
        nombre: 'Aguas de Cundinamarca',
        nit: '800.123.456-7',
        municipio: 'Bogota',
        departamento: 'Cundinamarca',
        representante_legal: '',
        representante_legal_cedula: '',
      },
      suscriptor: {
        codigo: '00001',
        nombre_apellidos: 'Maria Lopez',
        cedula: '123456789',
        email: 'maria@example.test',
        telefono: '3001234567',
        municipio: 'Bogota',
        sector: null,
        calle: null,
        direccion: 'Calle 1',
        estrato: 2,
        estado: 'activo',
        matricula_inmobiliaria: 'MATRICULA-SECRETA',
        numero_catastral: null,
        id_prestador: 1,
        categoria_uso: 'residencial',
      },
      medidor: {
        id_medidor: 10,
        numero_medidor: 'MED-10',
        estado: 'activo',
        fecha_instalacion: '2024-01-01',
      },
      periodo: {
        id_periodo: '202601',
        fecha_inicio: '2026-01-01',
        fecha_fin: '2026-01-31',
        fecha_pago_sin_recargo: '2026-02-15',
        fecha_pago_con_recargo: '2026-02-28',
        dias_consumo: 31,
      },
      operario: {
        id_operario: 7,
        id_prestador: 1,
        numero_cedula: '987654321',
        nombre: 'Ana Gomez',
        email: 'ana@example.test',
        rol: 'operario',
        estado: 'activo',
        dispositivo_id: 'MZ-001',
      },
      lectura: {
        lectura_actual: 1012,
        lectura_anterior: 1000,
        estado_validacion: 'validado',
        evidencia_foto_path: null,
        evidencia_foto_hash: null,
        timestamp_captura: '2026-02-01T08:30:00.000Z',
        observaciones: null,
      },
      liquidacion: {
        id: 'liq-1',
        hash: 'liquidacion-hash-no-se-comparte',
        resultado: { total: 17000 },
      },
      consumosHistoricos: [],
      otros_valores: [
        { concepto: 'RECONEXION', valor: 5000 },
        { concepto: 'MULTA', valor: 2000 },
      ],
      saldo_anterior: 3000,
      metadata: { hash_version: 'v2' },
    },
    hash: 'factura-hash-no-se-comparte',
    codigo_verificacion: 'ABC123XYZ0',
    version_tarifa_aplicada: '825-907-v1',
    referencia_pago: '1-202601-99-A1B2',
    created_at: '2026-02-01T10:00:00.000Z',
  } as unknown as Factura;
}

function crearPorts(disponible = true): {
  sharing: jest.Mocked<SharingSharePort>;
  fileSystem: jest.Mocked<FileSystemSharePort>;
} {
  return {
    sharing: {
      isAvailableAsync: jest.fn().mockResolvedValue(disponible),
      shareAsync: jest.fn().mockResolvedValue(undefined),
    },
    fileSystem: {
      cacheDirectory: 'file:///cache/',
      writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
    },
  };
}

describe('compartirFactura', () => {
  it('arma texto normativo sin volcar datos sensibles', () => {
    const texto = armarTextoCompartir(crearFactura(), {
      ticket: ['linea interna que no debe gobernar el formato'],
    });

    expect(texto).toContain('Aguas de Cundinamarca');
    expect(texto).toContain('NIT: 800.123.456-7');
    expect(texto).toContain('Cod. Verificación: ABC123XYZ0');
    expect(texto).toContain('Referencia: 1-202601-99-A1B2');
    expect(texto).toContain('RECONEXION: 5000');
    expect(texto).toContain('MULTA: 2000');
    expect(texto).toContain('Saldo anterior: 3000');
    expect(texto.endsWith('\n')).toBe(true);
    expect(texto).not.toContain('maria@example.test');
    expect(texto).not.toContain('3001234567');
    expect(texto).not.toContain('MATRICULA-SECRETA');
    expect(texto).not.toContain('factura-hash-no-se-comparte');
  });

  it('escribe un txt y abre el share sheet con mime type plano', async () => {
    const ports = crearPorts();
    await compartirFactura(crearFactura(), ports.sharing, ports.fileSystem);

    expect(ports.fileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      'file:///cache/factura-factura-share-1.txt',
      expect.stringContaining('Cod. Verificación: ABC123XYZ0'),
    );
    expect(ports.sharing.shareAsync).toHaveBeenCalledWith(
      'file:///cache/factura-factura-share-1.txt',
      { mimeType: 'text/plain', dialogTitle: 'Compartir factura' },
    );
  });

  it('rechaza de forma accionable si el share sheet no está disponible', async () => {
    const ports = crearPorts(false);

    await expect(compartirFactura(crearFactura(), ports.sharing, ports.fileSystem)).rejects.toMatchObject({
      code: 'SHARE_UNAVAILABLE',
      message: 'No hay apps para compartir',
    });
    expect(ports.fileSystem.writeAsStringAsync).not.toHaveBeenCalled();
  });

  it('trata la cancelación del usuario como cancelación, no como error', async () => {
    const ports = crearPorts();
    ports.sharing.shareAsync.mockRejectedValueOnce(new Error('User cancelled'));

    await expect(compartirFactura(crearFactura(), ports.sharing, ports.fileSystem)).resolves.toBe(false);
  });
});
