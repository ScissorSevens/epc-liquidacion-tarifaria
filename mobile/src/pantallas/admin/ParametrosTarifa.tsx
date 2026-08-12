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
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { BotonPrimario } from '../../componentes/BotonPrimario';
import { FormField } from '../../componentes/FormField';
import { ResumenCargos } from '../../componentes/ResumenCargos';
import { IconoGuardar } from './componentes/IconoGuardar';
import {
  scrollToFirstError,
  useFormFieldRefs,
} from '../../componentes/scroll-to-first-error';
import { SeccionForm } from '../../componentes/SeccionForm';
import { TopBar } from '../../componentes/TopBar';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../theme/skeletal-tokens';
import { useWorkspace } from '../../composicion/useWorkspace';
import { getBootstrap } from '../../composition/get-bootstrap';
import {
  CMA_MINIMO_ACUEDUCTO,
  CMA_MINIMO_ALCANTARILLADO,
  calcularCargos,
  type ParametrosTarifa,
  type ParametrosTarifaRepository,
} from '../../../dominio/parametros-tarifa';
import { limiteConsumoBasicoMensual, LIMITES_CONSUMO_BASICO_MS3 } from '../../../dominio/motor-tarifario/consumo-basico';
import type { AcuerdoMunicipalRepository } from '../../../dominio/acuerdo-municipal';
import { buildBorradorLocal } from './parametros-tarifa-build-borrador';
import { calcularFactorIpc } from '../../../dominio/parametros-tarifa/ipc';
import { useParametrosFormState } from './hooks/useParametrosFormState';

/**
 * Icono del botón Guardar segun plataforma.
 *
 * iOS: SF Symbol "tray.and.arrow.down" (guardar) via expo-image.
 * Android (y default): MaterialIcons "save" via @expo/vector-icons.
 *
 * Esto reemplaza el `<MaterialIcons name="save" />` previo (admin-
 * parametros-tarifa-redesign Task 2). En iOS el SF Symbol usa el
 * weight/style del sistema, se ve mas nitido y respeta el tint del
 * boton (tintColor: systemBlue).
 *
 * Devuelve un ReactNode que se pasa como `iconoComponente` a
 * `BotonPrimario`. En iOS es `<Image>` de expo-image; en Android es
 * `<MaterialIcons>` directo para mantener la propagacion del testID
 * (`param-guardar-icon`) que esperan los tests de regresion.
 *
 * Decompose Phase 1 task 1.1: el IconoGuardar ahora vive en
 * `./componentes/IconoGuardar.tsx` (import arriba). El componente
 * sigue siendo presentational puro — sin state, no side effects.
 */

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

const periodoDefault = (): number => Number(new Date().toISOString().slice(0, 4));

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

  const num = (s: string): number => {
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };
  const entero = (s: string): number => {
    const n = parseInt(s, 10);
    return isNaN(n) ? 0 : n;
  };

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

  // Estado de errores de validación inline. Cada FormField con error
  // potencial consume `formState.errores.cma | suscriptores | vigenteHasta`.
  // El state de errores vive en el hook (setErrores internal) para que
  // `validarTodo()` y `guardar()` lo puedan actualizar de forma consistente.

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

      <SeccionForm titulo="Periodo y vigencia" icono="event" testID="seccion-card-periodo">
        <View style={estilos.campo}>
          <FormField
            label="Periodo (año tarifario, 5 años)"
            required
            value={formState.values.periodo}
            onChangeText={formState.setters.setPeriodo}
            keyboardType="numeric"
            editable={!guardando && !cargandoInputs}
            selectable
            tabularNums
            testID="param-periodo"
          />
        </View>
        {/* Cleanup C-1/A-2 (verify-report `param-tarifa-residuales-cra-825`):
            El input `anio_base` estaba duplicado en dos FormFields (uno
            en "Periodo y vigencia" + otro en "Indexación IPC") bindeando
            el mismo state. UX confusa: editar uno actualizaba el otro y
            el error inline solo aparecía en el segundo. Decisión B/B/B:
            mantener el de la sección IPC por agrupación conceptual
            (anio_base + anio_destino + factor + ipuf_indice viven juntos).
            El input de "Periodo y vigencia" se elimina. El label del
            sobreviviente ya aclara "Año de referencia para la tabla IPC
            del DANE", coherente con la sección. */}
        <View style={estilos.campo}>
          <FormField
            label="Vigente desde (YYYY-MM-DD)"
            value={formState.values.vigenteDesde}
            onChangeText={formState.setters.setVigenteDesde}
            editable={!guardando && !cargandoInputs}
            selectable
            tabularNums
            accessibilityHint="Fecha de inicio de vigencia del periodo tarifario"
            testID="param-vigente-desde"
          />
        </View>
        <View style={estilos.campo}>
          <FormField
            label="Vigente hasta (YYYY-MM-DD)"
            value={formState.values.vigenteHasta}
            onChangeText={formState.setters.setVigenteHasta}
            editable={!guardando && !cargandoInputs}
            selectable
            tabularNums
            accessibilityHint="Fecha de fin de vigencia del periodo tarifario"
            error={formState.errores.vigenteHasta}
            ref={getRef('vigenteHasta')}
            testID="param-vigente-hasta"
          />
        </View>
      </SeccionForm>

      <SeccionForm titulo="Indexación IPC (Art. 11 Res CRA 825/2017)" icono="trending-up" testID="seccion-card-ipc">
        <Text style={estilos.nota}>
          Factor de indexación IPC para actualizar precios sin re-emitir la metodología tarifaria. El admin puede
          tipear el factor manualmente o tomar el factor calculado automáticamente a partir de los años base y destino.
        </Text>
        <View style={estilos.campo}>
          <FormField
            label="Anio base IPC (Res CRA 825 Art. 7, default 2016)"
            value={formState.values.anioBase}
            onChangeText={formState.setters.setAnioBase}
            keyboardType="numeric"
            editable={!guardando && !cargandoInputs}
            selectable
            tabularNums
            helperText="Norma CRA 825: anio_base=2016 (default). Año de referencia para la tabla IPC del DANE."
            error={formState.errores.anioBase}
            ref={getRef('anioBase')}
            testID="param-anio-base-ipc"
          />
        </View>
        <View style={estilos.campo}>
          <FormField
            label="Anio destino (indexación)"
            value={formState.values.anioDestino}
            onChangeText={formState.setters.setAnioDestino}
            keyboardType="numeric"
            editable={!guardando && !cargandoInputs}
            selectable
            tabularNums
            helperText="Año al que se quiere indexar. Default = periodo tarifario vigente."
            error={formState.errores.anioDestino}
            ref={getRef('anioDestino')}
            testID="param-anio-destino"
          />
        </View>
        <View style={estilos.campo}>
          <FormField
            label="Factor de indexación IPC (override manual)"
            value={formState.values.factorIpc}
            onChangeText={formState.setters.setFactorIpc}
            keyboardType="numeric"
            editable={!guardando && !cargandoInputs}
            selectable
            tabularNums
            helperText="Default 1.0 (sin indexación). El admin puede override manual sobre el factor calculado."
            error={formState.errores.factorIpc}
            ref={getRef('factorIpc')}
            testID="param-factor-ipc"
          />
        </View>
        <View style={estilos.campo}>
          <FormField
            label="IPUF indice (multiplicador de precios)"
            value={formState.values.ipufIndice}
            onChangeText={formState.setters.setIpufIndice}
            keyboardType="numeric"
            editable={!guardando && !cargandoInputs}
            selectable
            tabularNums
            helperText="Multiplicador del IPUF (Res CRA 825 Art. 7). Default 1.0 (sin ajuste)."
            error={formState.errores.ipufIndice}
            ref={getRef('ipufIndice')}
            testID="param-ipuf-indice"
          />
        </View>
        {/* Preview live del factor IPC calculado. Se actualiza conforme
            el admin modifica anioBase y anioDestino. Estilo secondary
            (mismo patron que param-altitud-preview). */}
        <Text
          style={estilos.previewAltitud}
          testID="param-ipc-preview"
        >
          {`Factor IPC calculado: ${calcularFactorIpc(entero(formState.values.anioBase), entero(formState.values.anioDestino)).toFixed(4)} (IPC ${entero(formState.values.anioDestino)} / IPC ${entero(formState.values.anioBase)})`}
        </Text>
      </SeccionForm>

      <SeccionForm titulo="Costos medios (estudio de costos del prestador)" icono="calculate" testID="seccion-card-cma">
        <Text style={estilos.nota}>Estos son los insumos de la fórmula normativa. El motor NO acepta inputs planos.</Text>
        <View style={estilos.campo}>
          <FormField
            label="CMA · Costo Medio Administración ($/año, art. 9)"
            value={formState.values.cma}
            onChangeText={formState.setters.setCma}
            keyboardType="numeric"
            editable={!guardando && !cargandoInputs}
            selectable
            tabularNums
            error={formState.errores.cma}
            ref={getRef('cma')}
            testID="param-cma"
          />
        </View>
        {/* El warning inline `param-cma-warning` se elimino en Commit 3.
            Ahora el error de CMA bajo el minimo normativo aparece
            inline en el FormField via `error={formState.errores.cma}` (FormField
            propaga su `error` a un TextInput con border rojo y texto
            debajo del campo). Migrar este test si rompe: T-DESIGN-3 o
            tests viejos que busquen `param-cma-warning` ya no aplican. */}
        <View style={estilos.campo}>
          <FormField
            label="CMO · Costo Medio Operación ($/m³)"
            value={formState.values.cmo}
            onChangeText={formState.setters.setCmo}
            keyboardType="numeric"
            editable={!guardando && !cargandoInputs}
            selectable
            tabularNums
            error={formState.errores.cmo}
            ref={getRef('cmo')}
            testID="param-cmo"
          />
        </View>
        <View style={estilos.campo}>
          <FormField
            label="CMI · Costo Medio Inversión ($/m³)"
            value={formState.values.cmi}
            onChangeText={formState.setters.setCmi}
            keyboardType="numeric"
            editable={!guardando && !cargandoInputs}
            selectable
            tabularNums
            testID="param-cmi"
          />
        </View>
        <View style={estilos.campo}>
          <FormField
            label="CMT · Costo Medio Tasas Ambientales ($/m³)"
            value={formState.values.cmt}
            onChangeText={formState.setters.setCmt}
            keyboardType="numeric"
            editable={!guardando && !cargandoInputs}
            selectable
            tabularNums
            testID="param-cmt"
          />
        </View>

        <View style={estilos.campoFila}>
          <MaterialIcons
            name="eco"
            size={24}
            color={COLORS.primary}
            style={estilos.switchFilaIcono}
            accessibilityElementsHidden
          />
          <View style={estilos.switchFilaText}>
            <Text style={estilos.switchFilaLabel}>Activar CMVIAA (art. 14 Res 907/2019)</Text>
          </View>
          <Switch
            value={formState.values.aplicaCmviaa}
            onValueChange={(v) => {
              // D5 (Commit 4): Haptics.selectionAsync en onValueChange de
              // switches (feedback sutil para iOS + Android).
              if (Platform.OS !== 'web') {
                void Haptics.selectionAsync();
              }
              formState.setters.setAplicaCmviaa(v);
            }}
            disabled={guardando || cargandoInputs}
            accessibilityLabel="Aplicar costo medio variable de inversión ambiental"
            testID="switch-cmviaa"
          />
        </View>
        {formState.values.aplicaCmviaa && (
          <View style={estilos.campo}>
            <FormField
              label="CMVIAA · Costo Medio Variable Inv. Ambientales Adicionales ($/m³)"
              value={formState.values.cmviaa}
              onChangeText={formState.setters.setCmviaa}
              keyboardType="numeric"
              editable={!guardando && !cargandoInputs}
              selectable
              tabularNums
              testID="param-cmviaa"
            />
          </View>
        )}

        {/* CMAA · Costo Medio de Administración por Inversiones Ambientales
            Adicionales (Res CRA 907/2019 art. 13 mod. Res CRA 825/2017 art. 9).
            SOLO aplica al servicio de ACUEDUCTO. Para alcantarillado el CF
            es solo CMA (sin CMAA). Fase 2 (task 4.5).

            Phase 2 task 2.4 (GREEN): flag explicito `aplicaCmaa` que
            MANDA sobre el valor numerico. Si el admin NO toggle, el
            input CMAA se renderiza deshabilitado (defensa UX: no se
            puede tipear un monto si el opt-in conceptual esta apagado).
            Mismo patron que el switch CMVIAA de arriba. */}
        <View style={estilos.campoFila}>
          <MaterialIcons
            name="eco"
            size={24}
            color={COLORS.primary}
            style={estilos.switchFilaIcono}
            accessibilityElementsHidden
          />
          <View style={estilos.switchFilaText}>
            <Text style={estilos.switchFilaLabel}>Aplicar CMAA (Res 907/2019 art. 13)</Text>
          </View>
          <Switch
            value={formState.values.aplicaCmaa}
            onValueChange={(v) => {
              if (Platform.OS !== 'web') {
                void Haptics.selectionAsync();
              }
              formState.setters.setAplicaCmaa(v);
            }}
            disabled={guardando || cargandoInputs}
            accessibilityLabel="Aplicar CMAA (Res 907/2019 art. 13)"
            testID="switch-cmaa"
          />
        </View>
        <View style={estilos.campo}>
          <FormField
            label="CMAA · Costo Medio Admin. Inversiones Ambientales Adic. ($/suscriptor/mes)"
            value={formState.values.cmaa}
            onChangeText={formState.setters.setCmaa}
            keyboardType="numeric"
            // Phase 2 task 2.4: input deshabilitado si flag apagado.
            // Si flag ON, el input se habilita pero sigue sujeto a
            // !guardando && !cargandoInputs como el resto del form.
            editable={!guardando && !cargandoInputs && formState.values.aplicaCmaa}
            selectable={formState.values.aplicaCmaa}
            tabularNums
            helperText="Solo aplica a servicio de ACUEDUCTO. Res CRA 907/2019 art. 14 (mod. art. 9 Res CRA 825/2017). El flag de arriba debe estar activo."
            testID="param-cmaa"
          />
        </View>

        {/* D2/D3 (Commit 2): ResumenCargos live preview. */}
        <ResumenCargos cargos={resumen} testID="resumen-cargos" />
      </SeccionForm>

      <SeccionForm titulo="Agua y suscriptores (insumo ASP = AS - IPUF×12×N)" icono="water-drop" testID="seccion-card-agua">
        <View style={estilos.campo}>
          <FormField
            label="Agua Suministrada año base (m³/año)"
            value={formState.values.aguaSuministrada}
            onChangeText={formState.setters.setAguaSuministrada}
            keyboardType="numeric"
            editable={!guardando && !cargandoInputs}
            selectable
            tabularNums
            testID="param-agua"
          />
        </View>
        <View style={estilos.campo}>
          <FormField
            label="IPUF (m³/suscriptor/mes, art. 5, estándar 6)"
            value={formState.values.ipuf}
            onChangeText={formState.setters.setIpuf}
            keyboardType="numeric"
            editable={!guardando && !cargandoInputs}
            selectable
            tabularNums
            helperText="Estándar CRA: 6 m³/suscriptor/mes"
            testID="param-ipuf"
          />
        </View>
        <View style={estilos.campo}>
          <FormField
            label="Suscriptores promedio (N) — divisor de CF = CMA/N"
            value={formState.values.suscriptoresPromedio}
            onChangeText={formState.setters.setSuscriptoresPromedio}
            keyboardType="numeric"
            editable={!guardando && !cargandoInputs}
            selectable
            tabularNums
            error={formState.errores.suscriptores}
            ref={getRef('suscriptores')}
            testID="param-suscriptores"
          />
        </View>
      </SeccionForm>

      <SeccionForm titulo="Altitud y consumo basico (Res CRA 750/2016)" icono="terrain" testID="seccion-card-altitud">
        <Text style={estilos.nota}>
          Res CRA 750/2016 art. 3: el limite de consumo basico (m3/mes subsidiables) depende de la altitud del prestador.
          Altitud &gt; 2.000 msnm = 11 m3; 1.000-2.000 msnm = 13 m3; &le; 1.000 msnm = 16 m3.
        </Text>
        <View style={estilos.campo}>
          <FormField
            label="Altitud del prestador (msnm)"
            value={formState.values.altitud}
            onChangeText={formState.setters.setAltitud}
            keyboardType="numeric"
            editable={!guardando && !cargandoInputs}
            selectable
            tabularNums
            helperText="Determina el limite de consumo basico (Res CRA 750/2016)"
            testID="param-altitud"
          />
        </View>
        <Text
          style={estilos.previewAltitud}
          testID="param-altitud-preview"
        >
          {`Limite de consumo basico: ${limiteConsumoBasicoMensual(num(formState.values.altitud))} m3/mes (altitud ${num(formState.values.altitud)} msnm)`}
        </Text>
      </SeccionForm>

      {/* Soporte documental (Fase 2, task 4.5). 3 campos opcionales
          para auditoria regulatoria: acto_adopcion, estudio_costos_id,
          documento_soporte_url. Todos pueden quedar vacios; si el
          admin los completa, deben ser URLs validas (acto_adopcion +
          documento_soporte_url) o string libre (estudio_costos_id). */}
      <SeccionForm titulo="Soporte documental (Res CRA 825/2017 + 907/2019)" icono="description" testID="seccion-card-soporte-documental">
        <Text style={estilos.nota}>
          Documentos opcionales que respaldan la metodologia tarifaria aplicada. Si los completa, las URLs deben ser publicas (http/https).
        </Text>
        <View style={estilos.campo}>
          <FormField
            label="Acto administrativo de adopcion (URL, decreto/resolucion)"
            value={formState.values.actoAdopcion}
            onChangeText={formState.setters.setActoAdopcion}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!guardando && !cargandoInputs}
            keyboardType="url"
            placeholder="https://..."
            error={formState.errores.actoAdopcion}
            ref={getRef('actoAdopcion')}
            accessibilityHint="URL del acto administrativo que adopta la metodologia tarifaria"
            testID="param-acto-adopcion"
          />
        </View>
        <View style={estilos.campo}>
          <FormField
            label="ID estudio de costos (referencia externa, ej: SUI)"
            value={formState.values.estudioCostosId}
            onChangeText={formState.setters.setEstudioCostosId}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!guardando && !cargandoInputs}
            helperText="Identificador del estudio de costos en el sistema externo (SUI o similar). String libre."
            testID="param-estudio-costos-id"
          />
        </View>
        <View style={estilos.campo}>
          <FormField
            label="Documento soporte del estudio (URL, PDF u otro)"
            value={formState.values.documentoSoporteUrl}
            onChangeText={formState.setters.setDocumentoSoporteUrl}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!guardando && !cargandoInputs}
            keyboardType="url"
            placeholder="https://..."
            error={formState.errores.documentoSoporteUrl}
            ref={getRef('documentoSoporteUrl')}
            accessibilityHint="URL del documento soporte del estudio de costos"
            testID="param-documento-soporte-url"
          />
        </View>
      </SeccionForm>

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
  // Commit 1: `titulo` y `sub` eliminados — el titulo vive en TopBar.
  seccion: { ...TYPOGRAPHY.headlineSm, color: COLORS.primary, marginTop: SPACING.md },
  nota: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant, fontStyle: 'italic', marginBottom: SPACING.xs },
  campo: { gap: SPACING.xs },
  // Fila del Switch: el Switch mide 24 px nativo. Sin minHeight explicito,
  // el hit-area efectivo cae a ~36 px y rompe WCAG 2.5.5 (≥ 44 px).
  // minHeight: 48 da margen suficiente sobre el switch.
  campoFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
  label: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant },
  // D6 (Commit 2): SwitchFila inline con icono MaterialIcons izq + hit-area >= 48.
  // SwitchFila NO se extrae a `componentes/` (D6): solo se usa 2 veces.
  switchFilaIcono: {
    marginRight: SPACING.xs,
  },
  switchFilaText: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  switchFilaLabel: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.onSurface,
  },
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
  // Preview en vivo del limite de consumo basico (Res CRA 750/2016).
  // Visible debajo del input de altitud. Texto secundario, sin fondo,
  // con padding para alinearlo con el field.
  previewAltitud: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.primary,
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  },
});