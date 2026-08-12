/**
 * Pantalla admin: parámetros tarifarios de un prestador por periodo (5 años).
 *
 * Edita los insumos del motor tarifario según Res CRA 825/2017 (art. 9-10) +
 * 907/2019 (art. 14): costos medios (CMA, CMO, CMI, CMT, CMVIAA), agua
 * (AS, IPUF, N), mínimo vital opcional.
 *
 * Multi-tenant: cada prestador tiene sus ParametrosTarifa (1 vigente
 * por periodo). El motor usa estos insumos + AcuerdoMunicipal.
 *
 * Commit 6 — FormField migration:
 *   - 14 inputs numericos migrados a FormField (periodo, costos medios,
 *     agua, suscriptores, fechas vigencia, mínimo vital).
 *   - Validación derivada del callsite via prop error.
 *   - Toggles preservados inline (no son text inputs).
 *   - Botón guardar reemplazado por BotonPrimario (CTAs consolidados).
 *
 * Decompose Phase 1 task 1.5 (GREEN):
 *   - Los 18 useState + useFocusEffect + validators + guardar inline
 *     se REEMPLAZAN por `useParametrosFormState()` (ver ./hooks/).
 *   - El screen queda con bootstrap + repos state + useFocusEffect
 *     (fetch) + TopBar + SeccionForm cards + BotonPrimario.
 *   - TODOS los testIDs y comments B/B/B se preservan verbatim.
 *   - El screen orquesta scroll-to-first-error (UI concern que vive
 *     en el caller, NO en el hook — proposal decision #7).
 *
 * Decompose Phase 2 task 2.7 (REFACTOR):
 *   - El render inline de las 6 SeccionForm se REEMPLAZA por 6
 *     subcomponentes presentational puros:
 *       - ParametrosTarifaPeriodo
 *       - ParametrosTarifaIPC
 *       - ParametrosTarifaCostos
 *       - ParametrosTarifaAgua
 *       - ParametrosTarifaAltitud
 *       - ParametrosTarifaSoporte
 *   - El screen queda como composition pura (~180 líneas):
 *     bootstrap + repos state + useFocusEffect (fetch) + formState +
 *     validation wrapper + TopBar + 6 subcomponentes + BotonPrimario.
 *   - TODOS los testIDs y comments B/B/B se preservan verbatim.
 *   - El `useMemo` del ResumenCargos vive en el screen (locality —
 *     proposal decision #8) y se pasa como prop `resumen` al
 *     subcomponente Costos.
 *   - `CampoConError` + `getRef` viven en el screen (UI concern) y
 *     se pasan narrowed a cada subcomponente.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { BotonPrimario } from '../../componentes/BotonPrimario';
import { ResumenCargos } from '../../componentes/ResumenCargos';
import { IconoGuardar } from './componentes/IconoGuardar';
import { ParametrosTarifaAgua } from './componentes/ParametrosTarifaAgua';
import { ParametrosTarifaAltitud } from './componentes/ParametrosTarifaAltitud';
import { ParametrosTarifaCostos } from './componentes/ParametrosTarifaCostos';
import { ParametrosTarifaIPC } from './componentes/ParametrosTarifaIPC';
import { ParametrosTarifaPeriodo } from './componentes/ParametrosTarifaPeriodo';
import { ParametrosTarifaSoporte } from './componentes/ParametrosTarifaSoporte';
import {
  scrollToFirstError,
  useFormFieldRefs,
} from '../../componentes/scroll-to-first-error';
import { TopBar } from '../../componentes/TopBar';
import { COLORS, SPACING, TYPOGRAPHY } from '../../theme/skeletal-tokens';
import { useWorkspace } from '../../composicion/useWorkspace';
import { getBootstrap } from '../../composition/get-bootstrap';
import {
  calcularCargos,
  type ParametrosTarifa,
  type ParametrosTarifaRepository,
} from '../../../dominio/parametros-tarifa';
import type { AcuerdoMunicipalRepository } from '../../../dominio/acuerdo-municipal';
import { buildBorradorLocal } from './parametros-tarifa-build-borrador';
import { useParametrosFormState } from './hooks/useParametrosFormState';

interface Props {
  /** Si no se provee, se toma del workspace (`useWorkspace.id_prestador_activo`). */
  readonly id_prestador?: number;
  /** Si no se provee, se busca via `acuerdoRepo.buscarVigente()` con la fecha actual. */
  readonly id_acuerdo?: number;
  /** Si no se provee, se busca via `repo.buscarVigente()` con la fecha actual. */
  readonly parametrosActuales?: ParametrosTarifa | null;
  /**
   * Si no se provee, se resuelve via `getBootstrap()` (patrón del resto
   * del código). Contrato: implementa `ParametrosTarifaRepository` del
   * dominio — el screen usa `buscarVigente` y `guardar`.
   */
  readonly repo?: ParametrosTarifaRepository;
  /** Si no se provee, se resuelve via `getBootstrap()` (requerido para derivar id_acuerdo). */
  readonly acuerdoRepo?: AcuerdoMunicipalRepository;
}

/**
 * Commit 1 (parametros-tarifa-impeccable-v2): el titulo inline + clamp
 * CSS se ELIMINARON del screen. El titulo ahora vive en TopBar con su
 * propia tipografia fija (bodyLg 18px en modo detalle).
 */

export default function ParametrosTarifaForm({
  id_prestador: idProp,
  id_acuerdo: idAcuerdoProp,
  parametrosActuales: parametrosProp,
  repo: repoProp,
  acuerdoRepo: acuerdoRepoProp,
}: Props) {
  // PER-05: selector específico. Suscripción limitada a id_prestador_activo
  // (único campo del store que este componente lee). Cambios en
  // acuerdo_vigente, parametros_vigentes, prestadores_disponibles,
  // cargando o prestador NO causan re-render.
  const id_prestador_activo = useWorkspace((s) => s.id_prestador_activo);
  const id_prestador = idProp ?? id_prestador_activo;
  const [repo, setRepo] = useState<ParametrosTarifaRepository | null>(repoProp ?? null);
  const [acuerdoRepo, setAcuerdoRepo] = useState<AcuerdoMunicipalRepository | null>(acuerdoRepoProp ?? null);
  const [id_acuerdo, setIdAcuerdo] = useState<number>(idAcuerdoProp ?? 0);
  const [parametrosActuales, setParametrosActuales] = useState<ParametrosTarifa | null>(parametrosProp ?? null);
  // cargando arranca true solo si vamos a fetchear (prop undefined).
  // Si la prop viene provista, no hay fetch → cargando=false desde el
  // inicio. Esto evita mantener los FormFields disabled infinitamente
  // cuando el caller ya inyectó los datos (Stack Navigation, test).
  const [cargando, setCargando] = useState(parametrosProp === undefined);

  // Cuando el Stack o el test inyecta `parametrosActuales` como prop,
  // el state interno debe reflejar esa prop. Sin esta sincronización,
  // useState solo toma el valor inicial del primer mount y un rerender
  // con prop distinta queda ignorado. Tests T-SYNC-1/T-SYNC-2 dependen
  // de esta transición null → valor para hidratar el state local.
  useEffect(() => {
    if (parametrosProp === undefined) return;
    setParametrosActuales(parametrosProp);
  }, [parametrosProp]);

  // Resolver repos internamente si no vinieron inyectados desde el Stack.
  useEffect(() => {
    if (repo !== null && acuerdoRepo !== null) return;
    let cancelado = false;
    void (async () => {
      const bs = await getBootstrap();
      if (cancelado) return;
      // El bootstrap retorna el adapter expo-sqlite que implementa el
      // contract `ParametrosTarifaRepository`. Sin cast: TS verifica
      // adhesion estructural directamente. Antes esto era:
      //   `bs.repos.parametrosTarifaRepo as unknown as ParametrosTarifaRepo`
      // (cast inseguro que tapaba el bug `repo.guardar is not a function`
      //  — ver TAREA 11 sdd-apply).
      if (repo === null) setRepo(bs.repos.parametrosTarifaRepo);
      if (acuerdoRepo === null) setAcuerdoRepo(bs.repos.acuerdoMunicipalRepo);
    })();
    return () => { cancelado = true; };
  }, [repo, acuerdoRepo]);

  // Derivar id_acuerdo a partir del acuerdo vigente del prestador en uso.
  useEffect(() => {
    if (idAcuerdoProp !== undefined) return;
    if (acuerdoRepo === null || id_prestador <= 0) return;
    let cancelado = false;
    void (async () => {
      const acuerdo = await acuerdoRepo.buscarVigente(id_prestador, new Date().toISOString());
      if (!cancelado) {
        setIdAcuerdo(acuerdo?.id_acuerdo ?? 0);
      }
    })();
    return () => { cancelado = true; };
  }, [acuerdoRepo, id_prestador, idAcuerdoProp]);

  // Cargar parámetros tarifarios vigentes para el prestador en uso.
  //
  // parametros-stale-state-fix: el fetch ahora corre dentro de
  // `useFocusEffect` en lugar de un `useEffect` plano. Beneficios:
  //   - En el mount inicial el comportamiento es equivalente: la pantalla
  //     arranca focused y el callback corre.
  //   - Cuando el operario da "Atrás" a Mi Perfil y vuelve a abrir la
  //     pantalla, React Navigation RE-FOCUSA la pantalla → el callback
  //     se vuelve a ejecutar → el form se re-hidrata con el último valor
  //     persistido en la DB (en lugar de quedar con los valores default
  //     del `useState(... ?? 0)` inicial).
  //   - El cleanup (cancelado=true) corre cuando la pantalla pierde focus
  //     o se desmonta, evitando state updates sobre componentes
  //     desmontados.
  //
  // El reset de `yaSincronizadoRef.current = false` ANTES de
  // `setParametrosActuales` garantiza que el sync effect (line 239) re-
  // hidrate los inputs locales con los datos frescos del repo en cada
  // focus. Sin este reset, el one-shot guard saltaría la re-hidratación
  // y el form quedaría con los valores viejos (los del primer mount).
  useFocusEffect(
    useCallback(() => {
      if (id_prestador <= 0 || repo === null) return;
      // Si la prop `parametrosActuales` viene provista, NO fetchamos —
      // la prop es la fuente de verdad (Stack Navigation o test).
      if (parametrosProp !== undefined) return;
      let cancelado = false;
      void (async () => {
        setCargando(true);
        try {
          const params = await repo.buscarVigente(id_prestador, new Date().toISOString());
          if (!cancelado) {
            // Reset one-shot guard ANTES de propagar al state local para
            // que el sync effect (ahora en el hook) re-hidrate los inputs
            // con datos frescos. El hook mantiene su propio ref.
            setParametrosActuales(params);
            setCargando(false);
          }
        } catch {
          if (!cancelado) setCargando(false);
        }
      })();
      return () => {
        cancelado = true;
      };
    }, [repo, id_prestador, parametrosProp]),
  );

  // ──────────────────────────────────────────────────────────────────
  // Hook `useParametrosFormState` — encapsula los 18 useState +
  // validators + guardar (Decompose Phase 1 task 1.3). El hook vive en
  // ./hooks/useParametrosFormState.ts. La firma completa y decisiones
  // B/B/B están documentadas en el header del hook.
  //
  // El screen pasa `parametrosActuales` (de la prop o del fetch del
  // useFocusEffect de arriba) como entrada; el hook hidrata el state
  // interno en la transición null → valor (one-shot guard).
  //
  // NO destructuramos `formState` — el render usa `formState.values.X`,
  // `formState.setters.setX`, `formState.errores.X` directo para que el
  // data flow sea explicito y la regression guard T-DECOMPOSE-4 (que
  // verifica el contrato "el screen consume el hook") matchee literal.
  // ──────────────────────────────────────────────────────────────────
  const formState = useParametrosFormState({
    id_prestador,
    id_acuerdo,
    repo,
    parametrosActuales,
  });

  // `guardando` se mantiene en el screen porque es UI concern del
  // BotonPrimario (spinner). El hook tiene su propio setGuardando
  // interno para evitar doble-persist; el screen solo expone este
  // flag al BotonPrimario.
  const [guardando, setGuardando] = useState(false);

  // D2 (parametros-tarifa-impeccable-v2 Commit 2): el shape de FormValues
  // ahora lo construye el hook una vez por render y lo expone en
  // `formState.values`. El screen lo consume directo para alimentar
  // el `useMemo` del card ResumenCargos (live preview).
  //
  // ResumenCargos live preview: useMemo con deps acotadas a los inputs
  // que afectan el calculo. Recalcula SOLO cuando esos cambian.
  // Si suscriptores_promedio=0 (division por cero) → CF=0 pero sigue
  // siendo valido (calcularCargos es defensivo). El card muestra
  // los cargos resultantes sin throw.
  const resumen = useMemo(() => {
    if (id_prestador <= 0) return null;
    try {
      const borrador = buildBorradorLocal(formState.values, {
        id_prestador,
        id_acuerdo,
        vigenteDesdePersistido: parametrosActuales?.vigente_desde,
      });
      return calcularCargos({
        ...borrador,
        id_parametros: 0,
        created_at: '',
      });
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formState.values.cma,
    formState.values.cmo,
    formState.values.cmi,
    formState.values.cmt,
    formState.values.cmviaa,
    formState.values.aplicaCmviaa,
    // Phase 2 task 2.4 (GREEN): aplicaCmaa tambien afecta el calculo
    // del cargo fijo (CF = cma + cmaa cuando flag=true). Sin este dep,
    // togglear el switch no actualiza el live preview del resumen.
    formState.values.aplicaCmaa,
    formState.values.cmaa,
    formState.values.suscriptoresPromedio,
    id_prestador,
    id_acuerdo,
    parametrosActuales,
  ]);

  // Wrapper de `formState.guardar()` que orquesta la UI concern del
  // scroll-to-first-error (proposal decision #7: el scroll vive en el
  // caller, NO en el hook). Pre-validamos con `formState.validarTodo()`
  // para setear errores + scroll ANTES de que el hook intente persistir.
  //
  // Por que wrapper:
  //   - `formState.guardar()` (del hook) ya hace validación interna como
  //     safety net — si la pre-validacion del screen pasa pero la del
  //     hook falla (caso edge: race condition), el hook NO persiste.
  //   - El doble `validarTodo()` es idempotente (mismo input → mismo
  //     output). Costo: ~5-10 validaciones de numeros por submit.
  //   - El wrapper expone `setGuardando(true/false)` para el spinner
  //     del BotonPrimario. El hook tiene su propio setGuardando
  //     interno que NO se refleja en la UI del screen.
  const handleGuardar = useCallback(async () => {
    // D4 (Commit 3): validación inline ANTES de persistir.
    // Si hay errores, populamos formState.errores (via setErrores)
    // y scrolleamos al primero. NO llamamos formState.guardar() en
    // este caso — el hook tiene su propio early-return si ve errores,
    // pero queremos el scroll-to-first-error que vive acá.
    const errors = formState.validarTodo();
    formState.setErrores(errors);
    if (Object.keys(errors).length > 0) {
      // D8: scroll al primer error en orden jerarquico.
      scrollToFirstError(scrollRef, errors, getRef);
      return;
    }
    setGuardando(true);
    try {
      // El hook persiste + sync workspace store + haptics + Alert.
      await formState.guardar();
    } finally {
      setGuardando(false);
    }
  }, [formState]);

  // Flag global de indisponibilidad. Activo mientras el bootstrap no
  // resuelve (repo null) o la carga inicial sigue en curso (cargando).
  // Mientras dure, todos los FormFields + Switches + el botón guardar
  // quedan disabled, y un ActivityIndicator visible señala el estado.
  // Ver admin-screen-perf-fixes #T-LOAD-1/#T-LOAD-2/#T-LOAD-3.
  const cargandoInputs = repo === null || cargando;

  // PER-05: navigation hook se invoca UNA vez al inicio del componente
  // (no en cada render). useNavigation de @react-navigation/native
  // retorna un objeto estable mientras la pantalla este montada.
  const navigation = useNavigation();

  // D8 (Commit 3): scroll-to-first-error. Map de refs por campo.
  // Cada FormField con error potencial recibe `ref={getRef(key)}` para
  // que `scrollToFirstError` pueda scrollear al primero.
  // Fase 2 (task 4.5): incluye 'actoAdopcion' y 'documentoSoporteUrl'.
  // Phase 3 task 3.4 (GREEN): 4 inputs nuevos de Indexación IPC.
  type CampoConError =
    | 'cma'
    | 'cmo'
    | 'suscriptores'
    | 'vigenteHasta'
    | 'actoAdopcion'
    | 'documentoSoporteUrl'
    // Phase 3 task 3.4 (GREEN): 4 inputs nuevos de Indexación IPC
    // que pueden disparar error inline.
    | 'anioBase'
    | 'anioDestino'
    | 'factorIpc'
    | 'ipufIndice';
  const { getRef } = useFormFieldRefs<CampoConError>();
  const scrollRef = useRef<ScrollView>(null);

  // ──────────────────────────────────────────────────────────────────
  // Decompose Phase 2 task 2.7 (REFACTOR): render composition puro.
  // El screen orquesta state + scroll + TopBar + 6 subcomponentes +
  // BotonPrimario. Los subcomponentes son presentational puros — leen
  // del `formState` y reciben `getRef` narrowed a las keys que cada
  // sección puede exhibir como error inline.
  // ──────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      ref={scrollRef}
      style={estilos.root}
      contentContainerStyle={estilos.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      {cargandoInputs && (
        <View style={estilos.cargandoContenedor}>
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
            testID="bootstrap-indicator"
          />
          <Text style={estilos.cargandoTexto}>Cargando contexto del prestador...</Text>
        </View>
      )}
      {/* TopBar con back (D7 — parametros-tarifa-impeccable-v2 Commit 1). */}
      <TopBar
        titulo="Parámetros Tarifarios"
        subtitulo={`Prestador #${id_prestador} · Res CRA 825/2017 + 907/2019 art. 14`}
        onBack={() => navigation.goBack()}
        testID="param-topbar"
        testIDBack="param-topbar-back"
      />

      <ParametrosTarifaPeriodo
        formState={formState}
        guardando={guardando}
        getRef={getRef}
      />

      <ParametrosTarifaIPC
        formState={formState}
        guardando={guardando}
        getRef={getRef}
      />

      <ParametrosTarifaCostos
        formState={formState}
        guardando={guardando}
        getRef={getRef}
        resumen={resumen}
      />

      <ParametrosTarifaAgua
        formState={formState}
        guardando={guardando}
        getRef={getRef}
      />

      <ParametrosTarifaAltitud
        formState={formState}
        guardando={guardando}
      />

      <ParametrosTarifaSoporte
        formState={formState}
        guardando={guardando}
        getRef={getRef}
      />

      <BotonPrimario
        texto="Guardar Parámetros"
        textoCargando="Guardando…"
        icono="save"
        iconoComponente={<IconoGuardar colorIcono={COLORS.onPrimary} testID="param-guardar-icon" />}
        tono="azul"
        onPress={handleGuardar}
        disabled={cargandoInputs}
        cargando={guardando}
        testID="param-guardar"
      />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, gap: SPACING.sm },
  // Loading indicator overlay. Visible mientras repo === null O cargando.
  // Centrado verticalmente con un label debajo para que el screen
  // reader anuncie el estado. El testID `bootstrap-indicator` vive en
  // el ActivityIndicator interno para que los tests puedan
  // identificar el spinner.
  cargandoContenedor: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  cargandoTexto: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.onSurfaceVariant,
  },
});
