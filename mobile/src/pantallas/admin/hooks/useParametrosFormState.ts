/**
 * Hook `useParametrosFormState` — encapsula los 18 useState +
 * validators + guardar del screen admin
 * `ParametrosTarifa` (Decompose Phase 1 task 1.3).
 *
 * El cuerpo de la validación vive en el módulo puro
 * `utils/validar-parametros-form.ts` (cleanup F3 del verify-report
 * de `parametros-tarifa-screen-decomposition`). Acá solo construimos
 * el input desde los values del form y delegamos. La razon:
 *   1. Testeable en aislamiento (60+ unit tests en el modulo puro,
 *      sin necesidad de renderHook ni mocks de React Navigation).
 *   2. Reusable si en el futuro agregamos otro form similar
 *      (ParametrosTarifaAuditoria? ParametrosTarifaBackup?).
 *   3. El hook queda como thin wrapper de 1 linea — mas facil de
 *      entender que 60 lineas de try/catch + if/else.
 *
 * POR QUE ESTE HOOK EXISTE:
 *   El screen `ParametrosTarifa.tsx` tenia 1155 lineas (single-file
 *   component con 4 concerns mezclados). Este hook extrae el primer
 *   concern: state management + validators + persistence orchestration.
 *   Phase 2 extrae los otros 3 (UI rendering) en 6 subcomponentes.
 *
 * RESPONSABILIDADES (1 sola fuente de verdad del form):
 *   1. Mantener los 18 inputs del form (16 strings + 2 booleans).
 *   2. Fetch asincronico inicial via `repo.buscarVigente` cuando la
 *      pantalla gana focus (parametros-stale-state-fix).
 *   3. Hidratar el state local cuando `parametrosActuales` cambia de
 *      null → valor (one-shot guard via `yaSincronizadoRef`).
 *   4. `validarTodo()` — pure logic. Retorna FormErrors sin side effects.
 *      El caller (screen) decide que hacer con los errores
 *      (setErrores + scrollToFirstError — UI orchestration).
 *   5. `guardar()` — orquesta: validar, build borrador via
 *      `buildBorradorLocal`, calcular cargos, persistir via
 *      `repo.guardar`, sincronizar workspace store via
 *      `useWorkspace.setParametrosVigentes`, haptic feedback, Alert.
 *
 * DECISIONES B/B/B (preservadas del screen original):
 *   - Validators puros (sin UI orchestration) → el screen se encarga
 *     del scroll-to-first-error (decisión #7 del proposal).
 *   - El sync `useWorkspace.setParametrosVigentes` vive en el hook
 *     para que el caller no necesite conocer la persistencia.
 *   - Haptic feedback plataforma-específico (iOS notificationAsync,
 *     Android selectionAsync, web no-op) preservado verbatim.
 *   - El one-shot guard (`yaSincronizadoRef`) se resetea a `false`
 *     antes de cada fetch del focus, permitiendo re-hidratación
 *     cuando el operario navega back+forward al screen.
 *   - Phase 2 task 2.4 (GREEN): flag explicito `aplica_cmaa` manda
 *     sobre el valor numerico (ver `buildBorradorLocal`).
 *   - Phase 3 task 3.4 (GREEN): IPC editable desde el form.
 *   - Phase 3 task 3.2 (GREEN): mínimo vital hardcodeado a false/0
 *     (la fuente de verdad es la tabla `minimo_vital`).
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

import {
  validarCmaMinimo,
  validarCmogMinimo,
  calcularCargos,
  type ParametrosTarifa,
  type ParametrosTarifaRepository,
} from '../../../../dominio/parametros-tarifa';
import {
  buildBorradorLocal,
  type FormValues,
} from '../parametros-tarifa-build-borrador';
import type { FormErrors } from '../../../componentes/scroll-to-first-error';
import { useWorkspace } from '../../../composicion/useWorkspace';
import { validarParametrosForm } from '../utils/validar-parametros-form';

/** Parametros del hook. */
export interface UseParametrosFormStateParams {
  /** Identificador del prestador activo del workspace. */
  readonly id_prestador: number;
  /** Identificador del acuerdo municipal vigente. */
  readonly id_acuerdo: number;
  /**
   * Repositorio inyectado. Si es `null` al primer render, el hook
   * intenta resolverlo via `getBootstrap()` (patrón del screen original).
   */
  readonly repo: ParametrosTarifaRepository | null;
  /**
   * Parametros persistidos. Si se provee, hidrata el state local
   * (one-shot guard) y NO dispara fetch asincronico.
   */
  readonly parametrosActuales: ParametrosTarifa | null;
}

/**
 * Setters del hook — uno por cada input del form.
 * El caller los pasa como `onChangeText` a los FormFields.
 */
export interface FormSetters {
  readonly setPeriodo: (v: string) => void;
  readonly setAnioBase: (v: string) => void;
  readonly setAnioDestino: (v: string) => void;
  readonly setFactorIpc: (v: string) => void;
  readonly setIpufIndice: (v: string) => void;
  readonly setCma: (v: string) => void;
  readonly setCmo: (v: string) => void;
  readonly setCmi: (v: string) => void;
  readonly setCmt: (v: string) => void;
  readonly setCmviaa: (v: string) => void;
  readonly setAplicaCmviaa: (v: boolean) => void;
  readonly setCmaa: (v: string) => void;
  readonly setAplicaCmaa: (v: boolean) => void;
  readonly setActoAdopcion: (v: string) => void;
  readonly setEstudioCostosId: (v: string) => void;
  readonly setDocumentoSoporteUrl: (v: string) => void;
  readonly setAguaSuministrada: (v: string) => void;
  readonly setIpuf: (v: string) => void;
  readonly setSuscriptoresPromedio: (v: string) => void;
  readonly setVigenteDesde: (v: string) => void;
  readonly setVigenteHasta: (v: string) => void;
  readonly setAltitud: (v: string) => void;
}

/** Return value del hook. */
export interface UseParametrosFormStateReturn {
  /** Estado actual de los inputs del form (16 strings + 2 booleans). */
  readonly values: FormValues;
  /** Setters para los 18 inputs (4 setters adicionales arriba). */
  readonly setters: FormSetters;
  /** Estado de errores de validación inline (poblado por `guardar`). */
  readonly errores: FormErrors;
  /** Setter del estado de errores (para que el caller pueda limpiarlos). */
  readonly setErrores: Dispatch<SetStateAction<FormErrors>>;
  /** True durante el fetch inicial del repo. */
  readonly cargando: boolean;
  /**
   * True mientras el bootstrap no resuelve (repo null) o la carga
   * inicial sigue en curso (cargando). El caller usa esto para
   * deshabilitar inputs + mostrar ActivityIndicator.
   */
  readonly cargandoInputs: boolean;
  /**
   * Pure validation. Retorna FormErrors sin side effects. El caller
   * decide que hacer con los errores (setErrores + scroll-to-first).
   */
  readonly validarTodo: () => FormErrors;
  /**
   * Side-effectful: valida, persiste via `repo.guardar`, sincroniza el
   * workspace store, dispara haptic feedback, y muestra Alert.
   */
  readonly guardar: () => Promise<void>;
}

/** Default de año tarifario (periodo vigente actual). */
const periodoDefault = (): number => Number(new Date().toISOString().slice(0, 4));

import { parseNum as num, parseEntero as entero } from '../utils/parse-numeric';

export function useParametrosFormState(
  params: UseParametrosFormStateParams,
): UseParametrosFormStateReturn {
  const { id_prestador, id_acuerdo, repo, parametrosActuales } = params;

  // ──────────────────────────────────────────────────────────────────
  // parametros-stale-state-fix Commit 2 (GREEN):
  //
  // El ref guardea la primera hidratación del state local desde la DB
  // para que ediciones del usuario NO se sobrescriban por re-fetches.
  // Antes vivía debajo de este useEffect (line 238 original); se mueve
  // ACÁ para que el `useFocusEffect` de más abajo pueda resetearlo a
  // `false` antes de cada re-hidratación por focus.
  const yaSincronizadoRef = useRef(false);

  // ──────────────────────────────────────────────────────────────────
  // State local del form — 16 strings + 2 booleans + 2 internos.
  //
  // Defaults:
  //   - Strings numericos → '0' (excepto anioBase='2016' normativo y
  //     ipuf='6' estandar CRA).
  //   - Strings texto → '' (actoAdopcion, estudioCostosId,
  //     documentoSoporteUrl).
  //   - Booleans → false.
  //   - periodo → año actual (dinámico).
  //   - vigenteDesde → hoy ISO.
  //   - vigenteHasta → año actual + 4 → 12-31.
  //   - altitud → '0' (nivel del mar → limite 16 m3/mes default).
  // ──────────────────────────────────────────────────────────────────
  const [periodo, setPeriodo] = useState(
    String(parametrosActuales?.periodo ?? periodoDefault()),
  );
  // anio_base: Res CRA 825/2017 Art. 7. Default 2016 (normativo).
  // Phase 3 task 3.4 (GREEN): ahora es editable para permitir override
  // del admin (cambios normativos). Validación > 2000.
  const [anioBase, setAnioBase] = useState(
    String(parametrosActuales?.anio_base ?? 2016),
  );
  // anio_destino_indexacion: Res CRA 825/2017 Art. 11. Default al
  // periodo tarifario vigente. Phase 3 task 3.4 (GREEN): input
  // editable. Permite override del admin para indexar contra otro año.
  const [anioDestino, setAnioDestino] = useState(
    String(
      parametrosActuales?.anio_destino_indexacion ??
        parametrosActuales?.periodo ??
        periodoDefault(),
    ),
  );
  // factor_indexacion_ipc: Res CRA 825/2017 Art. 11. Default 1.0 (sin
  // indexación). Phase 3 task 3.4 (GREEN): input editable. El admin
  // puede override manual; si no, se calcula via `calcularFactorIpc()`.
  const [factorIpc, setFactorIpc] = useState(
    String(parametrosActuales?.factor_indexacion_ipc ?? 1.0),
  );
  // ipuf_indice: multiplicador para actualizar precios sin re-emitir
  // metodología (Res CRA 825 Art. 7). Default 1.0. Phase 3 task 3.4
  // (GREEN): input editable para que el admin ajuste por IPC/IPC local.
  const [ipufIndice, setIpufIndice] = useState(
    String(parametrosActuales?.ipuf_indice ?? 1.0),
  );
  const [cma, setCma] = useState(String(parametrosActuales?.cma ?? 0));
  const [cmo, setCmo] = useState(String(parametrosActuales?.cmo ?? 0));
  const [cmi, setCmi] = useState(String(parametrosActuales?.cmi ?? 0));
  const [cmt, setCmt] = useState(String(parametrosActuales?.cmt ?? 0));
  const [cmviaa, setCmviaa] = useState(String(parametrosActuales?.cmviaa ?? 0));
  const [aplicaCmviaa, setAplicaCmviaa] = useState(
    parametrosActuales?.aplica_cmviaa ?? false,
  );
  // CMAA — Costo Medio de Administración por Inversiones Ambientales
  // Adicionales (Res CRA 907/2019 art. 13 que modifica Res CRA 825/2017
  // art. 9). SOLO aplica al servicio de ACUEDUCTO. Default 0 si el
  // prestador NO opta por inversiones ambientales; null backward-compat.
  // Fase 2 (`param-tarifa-res-825-compliance-phase2`, task 4.5).
  const [cmaa, setCmaa] = useState(String(parametrosActuales?.cmaa ?? 0));
  // Flag explicito `aplica_cmaa` (Phase 2 task 2.4 GREEN). Antes de
  // Phase 2 el CMAA se inferia de `cmaa > 0`, lo que permitia que un
  // admin que setea `cmaa = 0` por error apague el CMAA sin warning.
  // El flag es la fuente de verdad: si es false, el buildBorradorLocal
  // sobrescribe `cmaa` con 0 (motor NO computa CMAA). Si es true,
  // se respeta el valor numerico del input.
  const [aplicaCmaa, setAplicaCmaa] = useState(
    parametrosActuales?.aplica_cmaa ?? false,
  );
  // Documentos de soporte (Fase 2, task 4.5). Todos opcionales.
  // Default string vacia para que el input muestre placeholder.
  const [actoAdopcion, setActoAdopcion] = useState(
    parametrosActuales?.acto_adopcion ?? '',
  );
  const [estudioCostosId, setEstudioCostosId] = useState(
    parametrosActuales?.estudio_costos_id ?? '',
  );
  const [documentoSoporteUrl, setDocumentoSoporteUrl] = useState(
    parametrosActuales?.documento_soporte_url ?? '',
  );
  const [aguaSuministrada, setAguaSuministrada] = useState(
    String(parametrosActuales?.agua_suministrada_m3_anio ?? 0),
  );
  const [ipuf, setIpuf] = useState(
    String(parametrosActuales?.ipuf_m3_suscriptor_mes ?? 6),
  );
  const [suscriptoresPromedio, setSuscriptoresPromedio] = useState(
    String(parametrosActuales?.suscriptores_promedio ?? 0),
  );
  // Phase 3 task 3.2 (GREEN) — Opción A: la captura de
  // `aplicaMinimoVital` + `m3Gratis` se ELIMINÓ del form. La fuente
  // de verdad del mínimo vital es la tabla `minimo_vital` (futuro
  // módulo admin). Las columnas en `parametros_tarifa` se mantienen
  // por backward-compat pero el buildBorradorLocal las hardcodea
  // a `false` / `0` (ver parametros-tarifa-build-borrador.ts).
  const [vigenteDesde, setVigenteDesde] = useState(
    parametrosActuales?.vigente_desde?.slice(0, 10) ??
      new Date().toISOString().slice(0, 10),
  );
  const [vigenteHasta, setVigenteHasta] = useState(
    parametrosActuales?.vigente_hasta?.slice(0, 10) ??
      `${Number(periodoDefault()) + 4}-12-31`,
  );
  // altitud_msnm: Res CRA 750/2016 compliance. Default 0 si no hay
  // (altitud a nivel del mar → limite 16 m3/mes por fallback).
  const [altitud, setAltitud] = useState(
    String(parametrosActuales?.altitud_msnm ?? 0),
  );

  // Estado interno: errores de validacion inline.
  const [errores, setErrores] = useState<FormErrors>({});
  // Cargando: true mientras el repo no terminó de fetchear los params
  // vigentes (parametros-stale-state-fix).
  const [cargando, setCargando] = useState(false);
  // Guardando: true durante `repo.guardar()` (UI: spinner en BotonPrimario).
  const [guardando, setGuardando] = useState(false);

  // Flag global de indisponibilidad. Activo mientras el bootstrap no
  // resuelve (repo null) o la carga inicial sigue en curso (cargando).
  // Mientras dure, todos los FormFields + Switches + el botón guardar
  // quedan disabled. Ver admin-screen-perf-fixes #T-LOAD-1/#T-LOAD-2/#T-LOAD-3.
  const cargandoInputs = repo === null || cargando;

  // ──────────────────────────────────────────────────────────────────
  // Hidratar el state local cuando `parametrosActuales` cambia
  // externamente. Solo sincroniza en la transición null → valor
  // (evita sobrescribir edición del usuario). El ref guardea la
  // primera hidratación para que un re-fetch posterior (mismos datos)
  // no pise lo que el operador tipeó. Ver scenario T-SYNC-1/T-SYNC-2.
  //
  // NOTA: el `useFocusEffect` que originalmente acompañaba a este sync
  // (parametros-stale-state-fix) fue removido en el F1 cleanup del
  // verify-report de `parametros-tarifa-screen-decomposition`: era
  // no-op real (solo reseteaba un ref que el screen ya resetea cuando
  // refetchea). El fetch + re-pasar `parametrosActuales` sigue siendo
  // responsabilidad del caller (screen), via `useFocusEffect` en
  // `ParametrosTarifa.tsx`.
  useEffect(() => {
    if (parametrosActuales === null) return;
    if (yaSincronizadoRef.current) return;
    setPeriodo(String(parametrosActuales.periodo));
    setAnioBase(String(parametrosActuales.anio_base));
    setCma(String(parametrosActuales.cma));
    setCmo(String(parametrosActuales.cmo));
    setCmi(String(parametrosActuales.cmi));
    setCmt(String(parametrosActuales.cmt));
    setCmviaa(String(parametrosActuales.cmviaa));
    setAplicaCmviaa(parametrosActuales.aplica_cmviaa);
    // CMAA + 3 docs (Fase 2, task 4.5). Si el parametro persisted
    // tiene null, el input vuelve a string vacio (default limpio).
    setCmaa(String(parametrosActuales.cmaa ?? 0));
    // Phase 2 task 2.4 (GREEN): flag explicito `aplica_cmaa`. Si el
    // parametro persisted no tiene el flag (legacy data pre-Phase 2),
    // caemos a false (no aplica CMAA).
    setAplicaCmaa(parametrosActuales.aplica_cmaa ?? false);
    setActoAdopcion(parametrosActuales.acto_adopcion ?? '');
    setEstudioCostosId(parametrosActuales.estudio_costos_id ?? '');
    setDocumentoSoporteUrl(parametrosActuales.documento_soporte_url ?? '');
    setAguaSuministrada(String(parametrosActuales.agua_suministrada_m3_anio));
    setIpuf(String(parametrosActuales.ipuf_m3_suscriptor_mes));
    setSuscriptoresPromedio(String(parametrosActuales.suscriptores_promedio));
    // Phase 3 task 3.4 (GREEN): re-hidratar los 3 inputs nuevos de IPC.
    // `anio_destino_indexacion` es `number | null` en el type — si
    // null (legacy data), caemos al periodo tarifario vigente.
    setAnioDestino(
      String(
        parametrosActuales.anio_destino_indexacion ??
          parametrosActuales.periodo,
      ),
    );
    setFactorIpc(String(parametrosActuales.factor_indexacion_ipc ?? 1.0));
    setIpufIndice(String(parametrosActuales.ipuf_indice ?? 1.0));
    setVigenteDesde(parametrosActuales.vigente_desde.slice(0, 10));
    setVigenteHasta(parametrosActuales.vigente_hasta.slice(0, 10));
    setAltitud(String(parametrosActuales.altitud_msnm ?? 0));
    yaSincronizadoRef.current = true;
  }, [parametrosActuales]);

  // ──────────────────────────────────────────────────────────────────
  // Validación pura. Sin side effects. Retorna FormErrors.
  //
  // Cleanup F3: el cuerpo de la validación se extrajo a
  // `utils/validar-parametros-form.ts` (modulo puro, 60+ unit tests
  // en aislamiento). Acá solo construimos el input y delegamos.
  const validarTodo = useCallback(
    (): FormErrors =>
      validarParametrosForm({
        cma,
        cmo,
        suscriptoresPromedio,
        vigenteDesde,
        vigenteHasta,
        actoAdopcion,
        documentoSoporteUrl,
        anioBase,
        anioDestino,
        factorIpc,
        ipufIndice,
      }),
    [
      cma,
      cmo,
      suscriptoresPromedio,
      vigenteDesde,
      vigenteHasta,
      actoAdopcion,
      documentoSoporteUrl,
      anioBase,
      anioDestino,
      factorIpc,
      ipufIndice,
    ],
  );

  // ──────────────────────────────────────────────────────────────────
  // D2 (parametros-tarifa-impeccable-v2 Commit 2): construimos el shape
  // de FormValues UNA vez por render. Reusado por `guardar()` y el
  // `useMemo` del card ResumenCargos (live preview) en el screen.
  const formValues: FormValues = useMemo(
    () => ({
      periodo,
      anioBase,
      // Phase 3 task 3.4 (GREEN): 3 inputs editables de Indexación IPC.
      anioDestino,
      factorIpc,
      ipufIndice,
      cma,
      cmo,
      cmi,
      cmt,
      cmviaa,
      cmaa,
      aplicaCmviaa,
      // Phase 2 task 2.4 (GREEN): flag explicito para CMAA.
      aplicaCmaa,
      actoAdopcion,
      estudioCostosId,
      documentoSoporteUrl,
      aguaSuministrada,
      ipuf,
      suscriptoresPromedio,
      vigenteDesde,
      vigenteHasta,
      altitud,
    }),
    [
      periodo,
      anioBase,
      anioDestino,
      factorIpc,
      ipufIndice,
      cma,
      cmo,
      cmi,
      cmt,
      cmviaa,
      cmaa,
      aplicaCmviaa,
      aplicaCmaa,
      actoAdopcion,
      estudioCostosId,
      documentoSoporteUrl,
      aguaSuministrada,
      ipuf,
      suscriptoresPromedio,
      vigenteDesde,
      vigenteHasta,
      altitud,
    ],
  );

  // Setters agrupados para que el caller los bindee directo a los
  // FormFields / Switches.
  const setters: FormSetters = useMemo(
    () => ({
      setPeriodo,
      setAnioBase,
      setAnioDestino,
      setFactorIpc,
      setIpufIndice,
      setCma,
      setCmo,
      setCmi,
      setCmt,
      setCmviaa,
      setAplicaCmviaa,
      setCmaa,
      setAplicaCmaa,
      setActoAdopcion,
      setEstudioCostosId,
      setDocumentoSoporteUrl,
      setAguaSuministrada,
      setIpuf,
      setSuscriptoresPromedio,
      setVigenteDesde,
      setVigenteHasta,
      setAltitud,
    }),
    [],
  );

  // ──────────────────────────────────────────────────────────────────
  // guardar() — orquesta validación, persistencia, sync store, haptic,
  // Alert. Side-effectful (no pure).
  const guardar = useCallback(async () => {
    if (repo === null) {
      Alert.alert('Error', 'El repositorio aún no está listo. Esperá un');
      return;
    }
    // D4 (Commit 3): validación inline ANTES de persistir.
    // Si hay errores, NO se llama repo.guardar; el state `errores`
    // se setea para que los FormFields los muestren inline.
    const errors = validarTodo();
    setErrores(errors);
    if (Object.keys(errors).length > 0) {
      // D8: scroll al primer error en orden jerarquico.
      // NOTA: el scroll-to-first-error es UI orchestration que vive en
      // el caller (screen). El hook retorna los errores y deja que el
      // screen haga `scrollToFirstError(scrollRef, errors, getRef)`.
      // Para preservar el comportamiento original, el caller debe
      // verificar `errores` después de `guardar()` y orquestar el scroll.
      return;
    }
    setGuardando(true);
    try {
      // D2: buildBorradorLocal() construye el shape COMPLETO desde el
      // state local (parametros-tarifa-build-borrador.ts). Reemplaza
      // el builder inline previo (~30 lineas) que NO reusaba entre
      // `guardar()` y el `useMemo` del ResumenCargos.
      //
      // `vigenteDesdePersistido` se pasa para que el helper preserve el
      // formato original de `vigente_desde` cuando el usuario NO editó
      // el campo (ver T-PARAM-STALE-PERSIST).
      const borrador = buildBorradorLocal(formValues, {
        id_prestador,
        id_acuerdo,
        vigenteDesdePersistido: parametrosActuales?.vigente_desde,
      });
      const cargos = calcularCargos({
        ...borrador,
        id_parametros: 0,
        created_at: '',
      });
      const persisted = await repo.guardar({
        ...borrador,
        cargo_fijo_resultante: cargos.cargo_fijo,
        cargo_consumo_resultante: cargos.cargo_consumo,
      });
      // mi-perfil-unification-and-param-persistence Commit 2 (T-PERSIST-*):
      // sincroniza el store Zustand con el payload que el repo aceptó. Sin
      // esta línea, `parametros_vigentes` queda stale y la liquidación usa
      // los valores anteriores aunque el form haya sido actualizado. El
      // setter se invoca via getState() para garantizar que la UI refleja
      // lo que realmente persiste el repo, no lo que el form dice.
      useWorkspace.getState().setParametrosVigentes(persisted);
      // Haptic feedback de exito:
      //   iOS: notificationAsync(Success) (T-NATIVE-5 existente).
      //   Android: selectionAsync (D5 — feedback sutil, sin notification
      //   que es iOS-first).
      //   Web: no-op (Platform.OS === 'web' filtrado abajo).
      if (Platform.OS === 'ios') {
        try {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
        } catch {
          // Haptics puede fallar en simulador o sin permisos — silencio.
        }
      } else if (Platform.OS === 'android') {
        try {
          await Haptics.selectionAsync();
        } catch {
          // Haptics puede fallar en simulador o sin permisos — silencio.
        }
      }
      Alert.alert('Éxito', 'Parámetros tarifarios guardados');
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setGuardando(false);
    }
  }, [
    repo,
    validarTodo,
    formValues,
    id_prestador,
    id_acuerdo,
    parametrosActuales,
  ]);

  return {
    values: formValues,
    setters,
    errores,
    setErrores,
    cargando,
    cargandoInputs,
    validarTodo,
    guardar,
  };
}