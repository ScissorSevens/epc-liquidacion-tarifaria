/**
 * Helper `bootstrapCompleto()` — Fase 5 Tarea 5.1.
 *
 * Crea atómicamente las 4 entidades necesarias para arrancar un tenant
 * nuevo en la DB local cuando la app se inicializa por primera vez
 * (estado `sin_setup` de AuthGate):
 *
 *   1. **Prestador** — con `codigo` auto-generado correlativo al max
 *      numérico existente (filtra el codigo legacy 'EPC-LEGACY' que
 *      la migration 009 inserta con id_prestador=0).
 *   2. **Acuerdo Municipal vigente** — con los topes default de
 *      L142/1994 art. 99.6 (subsidios negativos, contribuciones
 *      positivas, dentro de los rangos legales).
 *   3. **Parametros Tarifa vigentes** — vinculados al acuerdo, con
 *      los costos medios y datos base para un prestador rural
 *      segmento 2 (Res CRA 825/2017).
 *   4. **Operario** — vinculado al prestador creado, con `password`
 *      ya hasheado por el `Hasher` inyectado.
 *
 * Adicionalmente construye una `Sesion` fake local con `idPrestador`
 * consistente con el prestador creado. La sesion fake tiene un
 * `token` del estilo `fake-token-{ts}` y `expiresAt = now + 24h`.
 *
 * El backend real de autenticacion llega en Fase 6; mientras tanto
 * este helper le da al usuario una experiencia end-to-end funcional
 * sin depender del backend .NET.
 *
 * ATOMICIDAD:
 *   No usamos transacciones SQLite explícitas (los repos del proyecto
 *   no las exponen todavía). Confiamos en el orden + rollback manual
 *   de las filas creadas si una creacion posterior falla:
 *
 *     crear prestador → crear acuerdo → crear parametros → crear operario
 *                       (si falla)        (si falla)        (si falla)
 *                       borra prest.     borra prest.+ac.  borra los 3
 *
 *   Asi, en cualquier punto de falla, la DB queda en el mismo estado
 *   que estaba antes de invocar el helper. La UI puede re-intentar
 *   el wizard sin acumular basura.
 */

import type { Prestador, CrearPrestadorInput } from '../../dominio/prestadores/types';
import { crearPrestador } from '../../dominio/prestadores/validador-prestador';
import type { AcuerdoMunicipal } from '../../dominio/acuerdo-municipal/types';
import type { ParametrosTarifa } from '../../dominio/parametros-tarifa/types';
import type { Operario, OperarioBorrador } from '../../dominio/operarios/types';
import { crearOperario } from '../../dominio/operarios/operarios';
import type { Sesion } from './constantes';
import type { Hasher, IdGenerator } from '../../dominio/shared/ports';

/** Prestador con `crear()`, `listar()` y (opcional) `obtenerPorId()` para rollback. */
export interface PrestadorRepoPort {
  crear(data: CrearPrestadorInput): Promise<Prestador>;
  listar(): Promise<readonly Prestador[]>;
  eliminar(id_prestador: number): Promise<void>;
}

/** Acuerdo con `crear()` y `eliminar()` para rollback. */
export interface AcuerdoRepoPort {
  crear(data: Omit<AcuerdoMunicipal, 'id_acuerdo' | 'created_at'>): Promise<AcuerdoMunicipal>;
  eliminar(id_acuerdo: number): Promise<void>;
}

/** Parametros tarifa con `crear()` y `eliminar()` para rollback. */
export interface ParametrosRepoPort {
  crear(data: Omit<ParametrosTarifa, 'id_parametros' | 'created_at'>): Promise<ParametrosTarifa>;
  eliminar(id_parametros: number): Promise<void>;
}

/** Operario con `guardar()` (UPSERT del repo expo-sqlite) y `eliminar()` para rollback. */
export interface OperarioRepoPort {
  guardar(borrador: OperarioBorrador): Promise<Operario>;
  eliminar(id_operario: number): Promise<void>;
}

/** Datos crudos del operario que la UI envia al bootstrap. */
export interface OperarioBootstrapData {
  readonly numero_cedula: string;
  readonly nombre: string;
  readonly email?: string;
  readonly password: string;
}

/** Input completo del helper. */
export interface BootstrapCompletoInput {
  /** Datos del prestador SIN codigo (lo generamos nosotros correlativo). */
  readonly prestadorData: Omit<CrearPrestadorInput, 'codigo'>;
  readonly operarioData: OperarioBootstrapData;
}

/** Resultado del helper: prestador + acuerdo + parametros + operario + sesion. */
export interface BootstrapCompletoResultado {
  readonly prestador: Prestador;
  readonly acuerdo: AcuerdoMunicipal;
  readonly parametros: ParametrosTarifa;
  readonly operario: Operario;
  readonly sesion: Sesion;
}

/** Dependencias del helper (DI — todas las funciones reciben sus puertos). */
export interface BootstrapCompletoDeps {
  readonly prestadorRepo: PrestadorRepoPort;
  readonly acuerdoRepo: AcuerdoRepoPort;
  readonly parametrosRepo: ParametrosRepoPort;
  readonly operarioRepo: OperarioRepoPort;
  readonly hasher: Hasher;
  readonly idGenerator: IdGenerator;
  readonly input: BootstrapCompletoInput;
  /** Para tests que quieren inyectar un Date fijo. Default = new Date(). */
  readonly ahora?: () => Date;
}

// ── Constantes del dominio ──────────────────────────────────────────────────

/** Rango de validez inicial del acuerdo y los parametros (5 años, Res CRA 825/2017). */
const VIGENCIA_ANIOS = 5;

/** 24h en ms — la sesion local vence al dia siguiente del setup. */
const MS_EN_UN_DIA = 24 * 60 * 60 * 1000;

/** Defaults del Acuerdo Municipal segun L142/1994 art. 99.6 (rural segmento 2). */
const ACUERDO_DEFAULTS = {
  factor_subsidio_e1: -0.50,
  factor_subsidio_e2: -0.40,
  factor_subsidio_e3: -0.15,
  factor_contribucion_e5: 0.50,
  factor_contribucion_e6: 0.60,
  factor_contribucion_comercial: 0.50,
  factor_contribucion_industrial: 0.30,
} as const;

/** Defaults de Parametros Tarifa para un prestador rural segmento 2. */
const PARAMETROS_DEFAULTS = {
  cma: 5_000_000, // Costo Medio de Administración anual (COP)
  cmo: 800,        // Costo Medio de Operación por m³ (COP/m³)
  cmi: 200,        // Costo Medio de Inversión por m³
  cmt: 100,        // Costo Medio de Tasas Ambientales por m³
  cmviaa: 0,       // Sin inversión ambiental adicional por default
  aplica_cmviaa: false,
  agua_suministrada_m3_anio: 12_000,
  ipuf_m3_suscriptor_mes: 6,   // art. 5 Res CRA 825/2017
  aplica_minimo_vital: false,
  m3_gratis_minimo_vital: 0,
} as const;

// ── Helpers internos ────────────────────────────────────────────────────────

/**
 * Genera el siguiente codigo correlativo de 4 dígitos para un prestador.
 *
 * Toma el max de los codigos NUMERICOS existentes (parsea a entero),
 * suma 1 y devuelve el padding a 4 dígitos. Codigos no numéricos
 * (ej: 'EPC-LEGACY' que la migration 009 inserta) se IGNORAN para que
 * no se contaminen con NaN.
 *
 * Si la DB está vacía o solo tiene legacy, devuelve '0001'.
 */
function siguienteCodigoPrestador(prestadores: readonly Prestador[]): string {
  const maxNumerico = prestadores
    .map((p) => Number.parseInt(p.codigo, 10))
    .filter((n) => Number.isFinite(n) && n > 0)
    .reduce((max, n) => (n > max ? n : max), 0);
  return String(maxNumerico + 1).padStart(4, '0');
}

/** Calcula fecha_vigencia_desde = hoy (YYYY-MM-DD) y fecha_vigencia_hasta = hoy + 5 años. */
function calcularVigencia5Anios(ahora: Date): { desde: string; hasta: string } {
  const desde = ahora.toISOString();
  const hastaDate = new Date(ahora);
  hastaDate.setFullYear(hastaDate.getFullYear() + VIGENCIA_ANIOS);
  return { desde, hasta: hastaDate.toISOString() };
}

// ── Funcion principal ───────────────────────────────────────────────────────

/**
 * Crea el tenant completo (prestador + acuerdo + parametros + operario)
 * con rollback manual si alguna creacion falla. Devuelve la sesion local
 * para que la UI arme el `useWorkspace.setSesionCompleta()`.
 *
 * @throws `Error` con el mensaje del repo que fallo, si alguno falla.
 *          En ese caso, todas las filas creadas previamente se eliminan.
 */
export async function bootstrapCompleto(deps: BootstrapCompletoDeps): Promise<BootstrapCompletoResultado> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const { desde: fecha_vigencia_desde, hasta: fecha_vigencia_hasta } = calcularVigencia5Anios(ahora);

  // 1. Generar codigo correlativo y crear el prestador via factory del dominio
  //    (que valida todas las reglas de creacion: nombre, nit, cedula rep, etc.)
  const prestadoresExistentes = await deps.prestadorRepo.listar();
  const codigo = siguienteCodigoPrestador(prestadoresExistentes);

  const borradorPrestador = crearPrestador({
    ...deps.input.prestadorData,
    codigo,
  });

  const prestador = await deps.prestadorRepo.crear(borradorPrestador);

  // 2. Crear acuerdo municipal con los defaults L142/1994.
  //    Si falla, hacemos rollback del prestador.
  let acuerdo: AcuerdoMunicipal;
  try {
    acuerdo = await deps.acuerdoRepo.crear({
      id_prestador: prestador.id_prestador,
      factor_subsidio_e1: ACUERDO_DEFAULTS.factor_subsidio_e1,
      factor_subsidio_e2: ACUERDO_DEFAULTS.factor_subsidio_e2,
      factor_subsidio_e3: ACUERDO_DEFAULTS.factor_subsidio_e3,
      factor_contribucion_e5: ACUERDO_DEFAULTS.factor_contribucion_e5,
      factor_contribucion_e6: ACUERDO_DEFAULTS.factor_contribucion_e6,
      factor_contribucion_comercial: ACUERDO_DEFAULTS.factor_contribucion_comercial,
      factor_contribucion_industrial: ACUERDO_DEFAULTS.factor_contribucion_industrial,
      fecha_vigencia_desde,
      fecha_vigencia_hasta,
      acto_administrativo_url: null,
      observaciones: 'Acuerdo creado automáticamente por el wizard de setup inicial.',
    });
  } catch (err) {
    await deps.prestadorRepo.eliminar(prestador.id_prestador).catch(() => {
      // Si el rollback falla, no propagamos — el error original es el relevante.
    });
    throw err;
  }

  // 3. Crear parametros tarifa vinculados al acuerdo.
  //    Si falla, hacemos rollback de prestador + acuerdo.
  let parametros: ParametrosTarifa;
  try {
    // suscriptores_promedio del año base = urbanos + rurales
    const suscriptoresPromedio =
      borradorPrestador.num_suscriptores_urbanos + borradorPrestador.num_suscriptores_rurales;
    const periodo = ahora.getFullYear();

    parametros = await deps.parametrosRepo.crear({
      id_prestador: prestador.id_prestador,
      id_acuerdo: acuerdo.id_acuerdo,
      periodo,
      cma: PARAMETROS_DEFAULTS.cma,
      cmo: PARAMETROS_DEFAULTS.cmo,
      cmi: PARAMETROS_DEFAULTS.cmi,
      cmt: PARAMETROS_DEFAULTS.cmt,
      cmviaa: PARAMETROS_DEFAULTS.cmviaa,
      aplica_cmviaa: PARAMETROS_DEFAULTS.aplica_cmviaa,
      agua_suministrada_m3_anio: PARAMETROS_DEFAULTS.agua_suministrada_m3_anio,
      ipuf_m3_suscriptor_mes: PARAMETROS_DEFAULTS.ipuf_m3_suscriptor_mes,
      suscriptores_promedio: suscriptoresPromedio,
      aplica_minimo_vital: PARAMETROS_DEFAULTS.aplica_minimo_vital,
      m3_gratis_minimo_vital: PARAMETROS_DEFAULTS.m3_gratis_minimo_vital,
      vigente_desde: fecha_vigencia_desde,
      vigente_hasta: fecha_vigencia_hasta,
    });
  } catch (err) {
    await Promise.all([
      deps.acuerdoRepo.eliminar(acuerdo.id_acuerdo),
      deps.prestadorRepo.eliminar(prestador.id_prestador),
    ]).catch(() => {
      // Si el rollback falla, el error original manda.
    });
    throw err;
  }

  // 4. Crear el primer operario vinculado al prestador.
  //    Si falla, hacemos rollback completo de prestador + acuerdo + parametros.
  let operario: Operario;
  try {
    const password_hash = deps.hasher.sha256(deps.input.operarioData.password);
    // Si no se proporcioona email, el dominio exige uno valido (REGEX_EMAIL);
    // usamos el numero de cedula + '@local' como placeholder offline.
    const email =
      deps.input.operarioData.email ?? `${deps.input.operarioData.numero_cedula}@local`;

    const borradorOperario = crearOperario({
      id_prestador: prestador.id_prestador,
      numero_cedula: deps.input.operarioData.numero_cedula,
      nombre: deps.input.operarioData.nombre,
      email,
      password_hash,
      rol: 'operario',
      estado: 'activo',
    });

    operario = await deps.operarioRepo.guardar(borradorOperario);
  } catch (err) {
    await Promise.all([
      deps.parametrosRepo.eliminar(parametros.id_parametros),
      deps.acuerdoRepo.eliminar(acuerdo.id_acuerdo),
      deps.prestadorRepo.eliminar(prestador.id_prestador),
    ]).catch(() => {
      // Si el rollback falla, el error original manda.
    });
    throw err;
  }

  // 5. Construir la sesion local (placeholder hasta que llegue el backend).
  //    idOperario se propaga desde el operario recien creado — la Sesion
  //    debe llevarlo para que CapturarLectura pueda atribuir legalmente
  //    cada lectura (CRA 825/2017, ver COR-04 reporte de calidad).
  const sesion: Sesion = {
    token: `fake-token-${ahora.getTime()}`,
    cedula: operario.numero_cedula,
    nombre: operario.nombre,
    idOperario: operario.id_operario,
    idPrestador: prestador.id_prestador,
    expiresAt: ahora.getTime() + MS_EN_UN_DIA,
  };

  return { prestador, acuerdo, parametros, operario, sesion };
}
