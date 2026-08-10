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
 *   Las 4 inserciones se ejecutan dentro de `withTransactionAsync` sobre
 *   la misma conexion SQLite compartida por los repositorios. expo-sqlite
 *   confirma la transaccion si el callback resuelve y hace rollback
 *   automatico si cualquier repositorio rechaza. El error original se
 *   propaga al caller; no hay compensaciones ni errores tragados.
 */

import type { Prestador, CrearPrestadorInput } from '../../dominio/prestadores/types';
import { crearPrestador } from '../../dominio/prestadores/validador-prestador';
import type { AcuerdoMunicipal } from '../../dominio/acuerdo-municipal/types';
import { COMPONENTES_TARIFARIOS, calcularCargos, type ParametrosTarifa } from '../../dominio/parametros-tarifa';
import type { Operario, OperarioBorrador } from '../../dominio/operarios/types';
import { crearOperario } from '../../dominio/operarios/operarios';
import type { Sesion } from './constantes';
import { obtenerOCrearDeviceId } from './device-id';
import type { Hasher, IdGenerator } from '../../dominio/shared/ports';
import { validarAmbito } from '../../dominio/ambito-tarifario/validar-ambito';
import type { PrestadorAmbitoInfo, ResultadoAmbito } from '../../dominio/ambito-tarifario/types';

/** Prestador con acceso a la transaccion de la conexion SQLite compartida. */
export interface PrestadorRepoPort {
  crear(data: CrearPrestadorInput): Promise<Prestador>;
  listar(): Promise<readonly Prestador[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

/** Acuerdo municipal requerido por el bootstrap. */
export interface AcuerdoRepoPort {
  crear(data: Omit<AcuerdoMunicipal, 'id_acuerdo' | 'created_at'>): Promise<AcuerdoMunicipal>;
}

/** Parametros tarifa requeridos por el bootstrap. */
export interface ParametrosRepoPort {
  crear(data: Omit<ParametrosTarifa, 'id_parametros' | 'created_at'>): Promise<ParametrosTarifa>;
}

/** Operario con `crear()` para generar el id en SQLite. */
export interface OperarioRepoPort {
  crear(borrador: OperarioBorrador): Promise<Operario>;
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
  /**
   * Gate de ámbito tarifario (Fase 2, task 4.4 GREEN). Inyectado para
   * que los tests puedan simular NO_APLICA / INDETERMINADO / APLICA
   * sin tocar la implementación real de `validarAmbito`. Default =
   * la función pura del dominio `validarAmbito` (Res CRA 825/2017 +
   * Res CRA 1032/2026 art. 2.1.2.1.1.1).
   *
   * Si el gate retorna NO_APLICA, el bootstrap ABORTA con un error
   * claro que distingue "prestador no aplica a CRA 825/2017" de
   * "datos insuficientes para evaluar". El admin debe contactar a
   * soporte si NO_APLICA.
   */
  readonly validarAmbito?: (
    prestador: PrestadorAmbitoInfo,
    fecha: string,
  ) => ResultadoAmbito;
}

// ── Constantes del dominio ──────────────────────────────────────────────────

/** Rango de validez inicial del acuerdo y los parametros (5 años, Res CRA 825/2017). */
const VIGENCIA_ANIOS = 5;

/** 24h en ms — la sesion local vence al dia siguiente del setup. */
const MS_EN_UN_DIA = 24 * 60 * 60 * 1000;

/** Defaults del Acuerdo Municipal segun L142/1994 art. 99.6 (rural segmento 2).
 *
 * Subsidios separados por bloque (Res CRA 825/2017 compliance):
 *   - `_cf`: porcentaje sobre el Cargo Fijo (CMA/N).
 *   - `_basico`: porcentaje sobre el Consumo Basico (primeros 11/13/16 m3).
 *   - `_excedente`: SIEMPRE 0 por Res CRA 825/2017 art. 14 — el
 *     excedente NO se subsidia.
 *
 * Los campos legacy `factor_subsidio_e{1,2,3}` (factor unico sobre el
 * subtotal) se conservan por backward-compat con datos existentes. */
const ACUERDO_DEFAULTS = {
  // Legacy single-factor (backward-compat)
  factor_subsidio_e1: -0.60,
  factor_subsidio_e2: -0.50,
  factor_subsidio_e3: -0.40,
  // 3 porcentajes separados E1 (maximo nacional L142/1994 art. 99.6)
  factor_subsidio_e1_cf: -0.60,
  factor_subsidio_e1_basico: -0.60,
  factor_subsidio_e1_excedente: 0,
  // E2
  factor_subsidio_e2_cf: -0.50,
  factor_subsidio_e2_basico: -0.50,
  factor_subsidio_e2_excedente: 0,
  // E3
  factor_subsidio_e3_cf: -0.40,
  factor_subsidio_e3_basico: -0.40,
  factor_subsidio_e3_excedente: 0,
  // Contribuciones (single-factor, valido para E5/E6/comercial/industrial)
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
 * dentro de una unica transaccion SQLite. Devuelve la sesion local para
 * que la UI arme el `useWorkspace.setSesionCompleta()`.
 *
 * expo-sqlite 16 define `withTransactionAsync(task)` sin parametro `tx`;
 * los repositorios ya estan enlazados a la misma conexion y sus queries
 * participan en la transaccion activa.
 *
 * ## Gate de ámbito tarifario (Fase 2, task 4.4 GREEN)
 *
 * Antes de crear el Prestador, invoca `validarAmbito()` contra los
 * datos del input. Reglas (decision 2 del design §"Architecture
 * Decisions" + design §"Data Flow"):
 *
 *   - `APLICA` (Subtítulo 1 o 2): el bootstrap continúa.
 *   - `NO_APLICA`: el bootstrap ABORTA con error claro que distingue
 *     "prestador no aplica a CRA 825/2017" de "datos inválidos". El
 *     admin debe contactar a soporte — NO podemos continuar porque
 *     las facturas que se emitan no tendrían un Subtítulo tarifario
 *     aplicable.
 *   - `INDETERMINADO`: el bootstrap ABORTA con mensaje "datos
 *     insuficientes para evaluar el ámbito". El admin debe
 *     completar `cantidad_suscriptores` antes de continuar.
 *
 * El gate se evalúa ANTES de cualquier escritura (no crea prestador
 * ni abre transacción si el gate falla). Si pasa, la transacción
 * SQLite envuelve las 4 inserciones como antes.
 *
 * @throws El error original del repositorio que falle. SQLite revierte
 *         automaticamente todas las escrituras de la transaccion.
 * @throws `Error(MENSAJES_ERROR_BOOTSTRAP.AMBITO_NO_APLICA)` si el
 *         gate retorna NO_APLICA.
 * @throws `Error(MENSAJES_ERROR_BOOTSTRAP.AMBITO_INDETERMINADO)` si
 *         el gate retorna INDETERMINADO con datos insuficientes.
 */
export async function bootstrapCompleto(deps: BootstrapCompletoDeps): Promise<BootstrapCompletoResultado> {
  // ── Gate de ámbito tarifario (Fase 2, task 4.4 GREEN) ────────────────
  //
  // Se ejecuta ANTES de la transacción y ANTES de prestadorRepo.listar()
  // para garantizar que no se persiste NADA si el Prestador no aplica
  // o si los datos son insuficientes. La zona se infiere del input:
  //   - num_suscriptores_urbanos > 0 && rurales > 0 → MIXTA
  //   - num_suscriptores_urbanos > 0 → URBANA
  //   - num_suscriptores_rurales > 0 → RURAL (default)
  const inputCantidadSuscriptores =
    deps.input.prestadorData.num_suscriptores_urbanos +
    deps.input.prestadorData.num_suscriptores_rurales;
  const inputZona: PrestadorAmbitoInfo['zona'] =
    deps.input.prestadorData.num_suscriptores_urbanos > 0 &&
    deps.input.prestadorData.num_suscriptores_rurales > 0
      ? 'MIXTA'
      : deps.input.prestadorData.num_suscriptores_urbanos > 0
        ? 'URBANA'
        : 'RURAL';
  const fechaGate = (deps.ahora ?? (() => new Date()))().toISOString();
  const validarAmbitoFn = deps.validarAmbito ?? validarAmbito;
  const resultadoAmbito = validarAmbitoFn(
    {
      id_prestador: 0, // pre-creación; el id real se asigna al persistir
      cantidad_suscriptores: inputCantidadSuscriptores,
      zona: inputZona,
    },
    fechaGate,
  );
  if (resultadoAmbito.estado === 'NO_APLICA') {
    // Distinguimos el caso "prestador no aplica a CRA 825/2017" del
    // caso "datos insuficientes". El admin debe entender que contactar
    // a soporte es la acción correcta (no seguir). El mensaje ES
    // user-facing: el `Alert.alert` que lo muestra en `SetupInicial`
    // lo lee tal cual.
    throw new Error(
      `Este prestador no aplica a CRA 825/2017 (estado=${resultadoAmbito.estado}; ${resultadoAmbito.evidencia}). El setup no puede continuar. Contacte a soporte.`,
    );
  }
  if (resultadoAmbito.estado === 'INDETERMINADO') {
    // Datos insuficientes para evaluar el ámbito. Por diseño, el
    // bootstrap acepta como input solo suscriptores numéricos (no
    // null), así que INDETERMINADO solo se dispara si el caller
    // inyecta un mock — pero el contrato está claro: abortar.
    throw new Error(
      `Datos insuficientes para evaluar el ámbito tarifario (estado=${resultadoAmbito.estado}; ${resultadoAmbito.evidencia}). Configure la cantidad de suscriptores del prestador antes de continuar.`,
    );
  }
  // estado === 'APLICA' → continuar.

  let resultado: BootstrapCompletoResultado | undefined;

  await deps.prestadorRepo.withTransactionAsync(async () => {
    const ahora = (deps.ahora ?? (() => new Date()))();
    const { desde: fecha_vigencia_desde, hasta: fecha_vigencia_hasta } = calcularVigencia5Anios(ahora);

    // 1. Generar codigo correlativo y crear el prestador via factory del dominio.
    const prestadoresExistentes = await deps.prestadorRepo.listar();
    const codigo = siguienteCodigoPrestador(prestadoresExistentes);
    const borradorPrestador = crearPrestador({
      ...deps.input.prestadorData,
      codigo,
    });
    const prestador = await deps.prestadorRepo.crear(borradorPrestador);

    // 2. Crear acuerdo municipal con defaults L142/1994.
    //
    // Fase 2 (`param-tarifa-res-825-compliance-phase2`, task 4.2 GREEN):
    // el Acuerdo se crea en estado BORRADOR por default (decision 5
    // del design §"Architecture Decisions"). El admin debe cargar
    // `acto_administrativo_url` y promoverlo a ACTIVO antes de empezar
    // a liquidar. Razón regulatoria: si el bootstrap promoviera a
    // ACTIVO directamente, el prestador podría operar sin acto
    // administrativo formal, lo que viola la Res CRA 825/2017 art. 9.
    const acuerdo = await deps.acuerdoRepo.crear({
      id_prestador: prestador.id_prestador,
      // Legacy (backward-compat)
      factor_subsidio_e1: ACUERDO_DEFAULTS.factor_subsidio_e1,
      factor_subsidio_e2: ACUERDO_DEFAULTS.factor_subsidio_e2,
      factor_subsidio_e3: ACUERDO_DEFAULTS.factor_subsidio_e3,
      // 3 porcentajes separados (compliance nuevo)
      factor_subsidio_e1_cf: ACUERDO_DEFAULTS.factor_subsidio_e1_cf,
      factor_subsidio_e1_basico: ACUERDO_DEFAULTS.factor_subsidio_e1_basico,
      factor_subsidio_e1_excedente: ACUERDO_DEFAULTS.factor_subsidio_e1_excedente,
      factor_subsidio_e2_cf: ACUERDO_DEFAULTS.factor_subsidio_e2_cf,
      factor_subsidio_e2_basico: ACUERDO_DEFAULTS.factor_subsidio_e2_basico,
      factor_subsidio_e2_excedente: ACUERDO_DEFAULTS.factor_subsidio_e2_excedente,
      factor_subsidio_e3_cf: ACUERDO_DEFAULTS.factor_subsidio_e3_cf,
      factor_subsidio_e3_basico: ACUERDO_DEFAULTS.factor_subsidio_e3_basico,
      factor_subsidio_e3_excedente: ACUERDO_DEFAULTS.factor_subsidio_e3_excedente,
      factor_contribucion_e5: ACUERDO_DEFAULTS.factor_contribucion_e5,
      factor_contribucion_e6: ACUERDO_DEFAULTS.factor_contribucion_e6,
      factor_contribucion_comercial: ACUERDO_DEFAULTS.factor_contribucion_comercial,
      factor_contribucion_industrial: ACUERDO_DEFAULTS.factor_contribucion_industrial,
      fecha_vigencia_desde,
      fecha_vigencia_hasta,
      acto_administrativo_url: null,
      observaciones: 'Acuerdo creado automáticamente por el wizard de setup inicial.',
      estado: 'BORRADOR',
    });

    // 3. Crear parametros tarifa vinculados al acuerdo.
    const suscriptoresPromedio =
      borradorPrestador.num_suscriptores_urbanos + borradorPrestador.num_suscriptores_rurales;
    // Pre-calculamos cargo_fijo_resultante + cargo_consumo_resultante aqui
    // (factory del dominio: ver `calcularCargos`) — la Res 825/2017 compliance
    // exige que estos valores se persistan al guardar y NO se recalculen
    // en cada factura. Decoupling clave: si la metodologia cambia, las
    // facturas historicas NO se invalidan.
    const parametrosBorradorInmutable: Omit<ParametrosTarifa, 'id_parametros' | 'created_at' | 'cargo_fijo_resultante' | 'cargo_consumo_resultante'> = {
      id_prestador: prestador.id_prestador,
      id_acuerdo: acuerdo.id_acuerdo,
      periodo: ahora.getFullYear(),
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
      ipuf_indice: 1.0,
      componentes_aplicables: [...COMPONENTES_TARIFARIOS],
      minimo_vital: null,
      // Res CRA 825/2017 Art. 7 (anio_base) + Art. 11 (factor IPC).
      anio_base: 2016,
      factor_indexacion_ipc: 1.0,
      vigente_desde: fecha_vigencia_desde,
      vigente_hasta: fecha_vigencia_hasta,
    };
    const cargos = calcularCargos({
      ...parametrosBorradorInmutable,
      cargo_fijo_resultante: 0,
      cargo_consumo_resultante: 0,
    } as ParametrosTarifa);
    const parametrosBorrador: Omit<ParametrosTarifa, 'id_parametros' | 'created_at'> = {
      ...parametrosBorradorInmutable,
      cargo_fijo_resultante: cargos.cargo_fijo,
      cargo_consumo_resultante: cargos.cargo_consumo,
    };
    const parametros = await deps.parametrosRepo.crear(parametrosBorrador);

    // 4. Crear el primer operario vinculado al prestador Y al
    //    dispositivo actual. Sin `dispositivo_id`, Configuracion.tsx
    //    no encuentra al operario al aterrizar en Mi Perfil y muestra
    //    el formulario de "Sin operario asignado" en vez del perfil
    //    real. El helper `obtenerOCrearDeviceId()` es idempotente: en
    //    cold starts siguientes retorna el mismo UUID que ya esta en
    //    AsyncStorage bajo la clave `device_uuid`.
    const password_hash = deps.hasher.sha256(deps.input.operarioData.password);
    const email = deps.input.operarioData.email ?? '';
    const dispositivo_id = await obtenerOCrearDeviceId();
    const borradorOperario = crearOperario({
      id_prestador: prestador.id_prestador,
      numero_cedula: deps.input.operarioData.numero_cedula,
      nombre: deps.input.operarioData.nombre,
      email,
      password_hash,
      dispositivo_id,
      rol: 'operario',
      estado: 'activo',
    });
    const operario = await deps.operarioRepo.crear(borradorOperario);

    const sesion: Sesion = {
      token: `fake-token-${ahora.getTime()}`,
      cedula: operario.numero_cedula,
      nombre: operario.nombre,
      idOperario: operario.id_operario,
      idPrestador: prestador.id_prestador,
      expiresAt: ahora.getTime() + MS_EN_UN_DIA,
    };

    resultado = { prestador, acuerdo, parametros, operario, sesion };
  });

  if (resultado === undefined) {
    throw new Error('bootstrapCompleto: la transaccion finalizo sin resultado');
  }
  return resultado;
}
