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
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';

import { BotonPrimario } from '../../componentes/BotonPrimario';
import { FormField } from '../../componentes/FormField';
import { ResumenCargos } from '../../componentes/ResumenCargos';
import {
  scrollToFirstError,
  useFormFieldRefs,
  type FormErrors,
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
  validarCmaMinimo,
  type ParametrosTarifa,
  type ParametrosTarifaRepository,
} from '../../../dominio/parametros-tarifa';
import type { AcuerdoMunicipalRepository } from '../../../dominio/acuerdo-municipal';
import {
  buildBorradorLocal,
  type FormValues,
} from './parametros-tarifa-build-borrador';

/**
 * Colores resueltos con Platform.select + fallback hex.
 *
 * La propuesta de expo-native-ui menciona la `Color` API de `expo-router`
 * con semantica iOS (UIColor.label, UIColor.systemBackground, etc.) y
 * Android MaterialTheme. El paquete `expo-router` instalado en este
 * proyecto NO exporta una `Color` API publica. Implementamos un shim
 * equivalente que:
 *   - Documenta el contrato esperado (ios/android/default)
 *   - Resuelve a tokens hex del theme cuando la API nativa no esta
 *     disponible (Hermes en tests, build web, runtime legacy).
 *
 * Cualquier callsite que quiera un color "nativo" usa:
 *   `Platform.select({ ios: COLORES_NATIVOS.ios.label, default: COLORS.onSurface })`
 *
 * admin-parametros-tarifa-redesign Task 2 — integracion expo-native-ui.
 */
const COLORES_NATIVOS = {
  /** iOS label — texto primario sobre systemBackground. */
  label: Platform.select({
    ios: COLORS.onSurface,
    android: COLORS.onSurface,
    default: COLORS.onSurface,
  }),
  /** iOS secondaryLabel — texto secundario. */
  secondaryLabel: Platform.select({
    ios: COLORS.onSurfaceVariant,
    android: COLORS.onSurfaceVariant,
    default: COLORS.onSurfaceVariant,
  }),
  /** iOS separator — divisor de cards. */
  separator: Platform.select({
    ios: COLORS.outlineVariant,
    android: COLORS.outlineVariant,
    default: COLORS.outlineVariant,
  }),
  /** iOS systemBackground — fondo principal. */
  systemBackground: Platform.select({
    ios: COLORS.background,
    android: COLORS.background,
    default: COLORS.background,
  }),
  /** iOS systemBlue — tint por defecto de SF Symbols / CTAs. */
  systemBlue: Platform.select({
    ios: COLORS.brandAzulDigital,
    android: COLORS.brandAzulDigital,
    default: COLORS.brandAzulDigital,
  }),
};

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
 */
function IconoGuardar({
  colorIcono,
  testID,
}: {
  colorIcono: string;
  testID?: string;
}): React.ReactNode {
  if (Platform.OS === 'ios') {
    return (
      <Image
        source="sf:tray.and.arrow.down"
        style={{ width: 20, height: 20, tintColor: colorIcono }}
        tintColor={colorIcono}
        testID={testID}
        accessibilityLabel="Guardar parámetros"
      />
    );
  }
  // Android (y default): MaterialIcons directo.
  return (
    <MaterialIcons
      name="save"
      size={20}
      color={colorIcono}
      testID={testID}
      accessibilityLabel="Guardar parámetros"
    />
  );
}

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
  useEffect(() => {
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
          setParametrosActuales(params);
          setCargando(false);
        }
      } catch {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [repo, id_prestador, parametrosProp]);

  const [periodo, setPeriodo] = useState(String(parametrosActuales?.periodo ?? periodoDefault()));
  // anio_base: Res CRA 825/2017 Art. 7. Default 2016 (normativo).
  const [anioBase, setAnioBase] = useState(String(parametrosActuales?.anio_base ?? 2016));
  const [cma, setCma] = useState(String(parametrosActuales?.cma ?? 0));
  const [cmo, setCmo] = useState(String(parametrosActuales?.cmo ?? 0));
  const [cmi, setCmi] = useState(String(parametrosActuales?.cmi ?? 0));
  const [cmt, setCmt] = useState(String(parametrosActuales?.cmt ?? 0));
  const [cmviaa, setCmviaa] = useState(String(parametrosActuales?.cmviaa ?? 0));
  const [aplicaCmviaa, setAplicaCmviaa] = useState(parametrosActuales?.aplica_cmviaa ?? false);
  const [aguaSuministrada, setAguaSuministrada] = useState(String(parametrosActuales?.agua_suministrada_m3_anio ?? 0));
  const [ipuf, setIpuf] = useState(String(parametrosActuales?.ipuf_m3_suscriptor_mes ?? 6));
  const [suscriptoresPromedio, setSuscriptoresPromedio] = useState(String(parametrosActuales?.suscriptores_promedio ?? 0));
  const [aplicaMinimoVital, setAplicaMinimoVital] = useState(parametrosActuales?.aplica_minimo_vital ?? false);
  const [m3Gratis, setM3Gratis] = useState(String(parametrosActuales?.m3_gratis_minimo_vital ?? 0));
  const [vigenteDesde, setVigenteDesde] = useState(
    parametrosActuales?.vigente_desde?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  );
  const [vigenteHasta, setVigenteHasta] = useState(
    parametrosActuales?.vigente_hasta?.slice(0, 10) ?? `${Number(periodoDefault()) + 4}-12-31`,
  );
  const [guardando, setGuardando] = useState(false);

  // Hidratar el state local cuando parametrosActuales se carga async.
  // Solo sincroniza en la transición null → valor (evita sobrescribir
  // edición del usuario). El ref guardea la primera hidratación para
  // que un re-fetch posterior (mismos datos) no pise lo que el
  // operador tipeó. Ver scenario T-SYNC-1/T-SYNC-2.
  const yaSincronizadoRef = useRef(false);
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
    setAguaSuministrada(String(parametrosActuales.agua_suministrada_m3_anio));
    setIpuf(String(parametrosActuales.ipuf_m3_suscriptor_mes));
    setSuscriptoresPromedio(String(parametrosActuales.suscriptores_promedio));
    setAplicaMinimoVital(parametrosActuales.aplica_minimo_vital);
    setM3Gratis(String(parametrosActuales.m3_gratis_minimo_vital));
    setVigenteDesde(parametrosActuales.vigente_desde.slice(0, 10));
    setVigenteHasta(parametrosActuales.vigente_hasta.slice(0, 10));
    yaSincronizadoRef.current = true;
  }, [parametrosActuales]);

  const num = (s: string): number => {
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };
  const entero = (s: string): number => {
    const n = parseInt(s, 10);
    return isNaN(n) ? 0 : n;
  };

  // D4 (Commit 3): `validarTodo()` invoca `validarCmaMinimo()` del dominio
  // via try/catch (la funcion THROWS, no retorna string — D4 hallazgo
  // critico del design). Tambien valida reglas locales (suscriptores > 0
  // defensa anti division por cero, fechas invertidas).
  const validarTodo = (): FormErrors => {
    const errors: FormErrors = {};
    const cmaNum = num(cma);
    // Res CRA 825/2017 Art. 15: validarCmaMinimo THROWs si CMA < minimo.
    try {
      validarCmaMinimo(cmaNum, 'acueducto');
    } catch (e) {
      errors.cma = (e as Error).message;
    }
    // Suscriptores debe ser > 0 (defensa anti division por cero).
    if (entero(suscriptoresPromedio) <= 0) {
      errors.suscriptores = 'Suscriptores debe ser > 0';
    }
    // Vigente desde NO puede ser posterior a vigente hasta.
    if (
      vigenteDesde !== '' &&
      vigenteHasta !== '' &&
      vigenteDesde > vigenteHasta
    ) {
      errors.vigenteHasta = 'Vigente hasta debe ser posterior a vigente desde';
    }
    return errors;
  };

  // D2 (parametros-tarifa-impeccable-v2 Commit 2): construimos el shape
  // de FormValues UNA vez por render. Reusado por `guardar()` y el
  // `useMemo` del card ResumenCargos (live preview).
  const formValues: FormValues = {
    periodo,
    anioBase,
    cma,
    cmo,
    cmi,
    cmt,
    cmviaa,
    aplicaCmviaa,
    aguaSuministrada,
    ipuf,
    suscriptoresPromedio,
    aplicaMinimoVital,
    m3Gratis,
    vigenteDesde,
    vigenteHasta,
  };

  // ResumenCargos live preview: useMemo con deps acotadas a los inputs
  // que afectan el calculo. Recalcula SOLO cuando esos cambian.
  // Si suscriptores_promedio=0 (division por cero) → CF=0 pero sigue
  // siendo valido (calcularCargos es defensivo). El card muestra
  // los cargos resultantes sin throw.
  const resumen = useMemo(() => {
    if (id_prestador <= 0) return null;
    try {
      const borrador = buildBorradorLocal(formValues, {
        id_prestador,
        id_acuerdo,
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
    cma,
    cmo,
    cmi,
    cmt,
    cmviaa,
    aplicaCmviaa,
    suscriptoresPromedio,
    id_prestador,
    id_acuerdo,
  ]);

  const guardar = async () => {
    if (repo === null) {
      Alert.alert('Error', 'El repositorio aún no está listo. Esperá un instante.');
      return;
    }
    // D4 (Commit 3): validación inline ANTES de persistir.
    // Si hay errores, NO se llama repo.guardar; el state `errores`
    // se setea para que los FormFields los muestren inline.
    const errors = validarTodo();
    setErrores(errors);
    if (Object.keys(errors).length > 0) {
      // D8: scroll al primer error en orden jerarquico.
      scrollToFirstError(scrollRef, errors, getRef);
      return;
    }
    setGuardando(true);
    try {
      // D2: buildBorradorLocal() construye el shape COMPLETO desde el
      // state local (parametros-tarifa-build-borrador.ts). Reemplaza
      // el builder inline previo (~30 lineas) que NO reusaba entre
      // `guardar()` y el `useMemo` del ResumenCargos.
      const borrador = buildBorradorLocal(formValues, {
        id_prestador,
        id_acuerdo,
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
      // Haptic feedback de exito solo en iOS — Android tiene
      // Haptics.selectionAsync pero el patron UX aqui es notification
      // success que es iOS-first.
      if (Platform.OS === 'ios') {
        try {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
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
  };

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
  type CampoConError = 'cma' | 'suscriptores' | 'vigenteHasta';
  const { getRef } = useFormFieldRefs<CampoConError>();
  const scrollRef = useRef<ScrollView>(null);

  // Estado de errores de validación inline. Cada FormField con error
  // potencial consume `errores.cma | suscriptores | vigenteHasta`.
  const [errores, setErrores] = useState<FormErrors>({});

  return (
    <ScrollView
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
            value={periodo}
            onChangeText={setPeriodo}
            keyboardType="numeric"
            editable={!guardando && !cargandoInputs}
            selectable
            tabularNums
            testID="param-periodo"
          />
        </View>
        <View style={estilos.campo}>
          <FormField
            label="Anio base IPC (Res CRA 825 Art. 7, default 2016)"
            value={anioBase}
            onChangeText={setAnioBase}
            keyboardType="numeric"
            editable={!guardando && !cargandoInputs}
            selectable
            tabularNums
            helperText="Norma CRA 825: anio_base=2016 (default). Override posible."
            testID="param-anio-base"
          />
        </View>
        <View style={estilos.campo}>
          <FormField
            label="Vigente desde (YYYY-MM-DD)"
            value={vigenteDesde}
            onChangeText={setVigenteDesde}
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
            value={vigenteHasta}
            onChangeText={setVigenteHasta}
            editable={!guardando && !cargandoInputs}
            selectable
            tabularNums
            accessibilityHint="Fecha de fin de vigencia del periodo tarifario"
            error={errores.vigenteHasta}
            ref={getRef('vigenteHasta')}
            testID="param-vigente-hasta"
          />
        </View>
      </SeccionForm>

      <SeccionForm titulo="Costos medios (estudio de costos del prestador)" icono="calculate" testID="seccion-card-cma">
        <Text style={estilos.nota}>Estos son los insumos de la fórmula normativa. El motor NO acepta inputs planos.</Text>
        <View style={estilos.campo}>
          <FormField
            label="CMA · Costo Medio Administración ($/año, art. 9)"
            value={cma}
            onChangeText={setCma}
            keyboardType="numeric"
            editable={!guardando && !cargandoInputs}
            selectable
            tabularNums
            error={errores.cma}
            ref={getRef('cma')}
            testID="param-cma"
          />
        </View>
        {/* El warning inline `param-cma-warning` se elimino en Commit 3.
            Ahora el error de CMA bajo el minimo normativo aparece
            inline en el FormField via `error={errores.cma}` (FormField
            propaga su `error` a un TextInput con border rojo y texto
            debajo del campo). Migrar este test si rompe: T-DESIGN-3 o
            tests viejos que busquen `param-cma-warning` ya no aplican. */}
        <View style={estilos.campo}>
          <FormField
            label="CMO · Costo Medio Operación ($/m³)"
            value={cmo}
            onChangeText={setCmo}
            keyboardType="numeric"
            editable={!guardando && !cargandoInputs}
            selectable
            tabularNums
            testID="param-cmo"
          />
        </View>
        <View style={estilos.campo}>
          <FormField
            label="CMI · Costo Medio Inversión ($/m³)"
            value={cmi}
            onChangeText={setCmi}
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
            value={cmt}
            onChangeText={setCmt}
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
            value={aplicaCmviaa}
            onValueChange={setAplicaCmviaa}
            disabled={guardando || cargandoInputs}
            accessibilityLabel="Aplicar costo medio variable de inversión ambiental"
            testID="switch-cmviaa"
          />
        </View>
        {aplicaCmviaa && (
          <View style={estilos.campo}>
            <FormField
              label="CMVIAA · Costo Medio Variable Inv. Ambientales Adicionales ($/m³)"
              value={cmviaa}
              onChangeText={setCmviaa}
              keyboardType="numeric"
              editable={!guardando && !cargandoInputs}
              selectable
              tabularNums
              testID="param-cmviaa"
            />
          </View>
        )}

        {/* D2/D3 (Commit 2): ResumenCargos live preview. */}
        <ResumenCargos cargos={resumen} testID="resumen-cargos" />
      </SeccionForm>

      <SeccionForm titulo="Agua y suscriptores (insumo ASP = AS - IPUF×12×N)" icono="water-drop" testID="seccion-card-agua">
        <View style={estilos.campo}>
          <FormField
            label="Agua Suministrada año base (m³/año)"
            value={aguaSuministrada}
            onChangeText={setAguaSuministrada}
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
            value={ipuf}
            onChangeText={setIpuf}
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
            value={suscriptoresPromedio}
            onChangeText={setSuscriptoresPromedio}
            keyboardType="numeric"
            editable={!guardando && !cargandoInputs}
            selectable
            tabularNums
            error={errores.suscriptores}
            ref={getRef('suscriptores')}
            testID="param-suscriptores"
          />
        </View>
      </SeccionForm>

      <SeccionForm titulo="Mínimo vital (Decreto 776/2025 — opcional)" icono="shield" testID="seccion-card-minimo-vital">
        <View style={estilos.campoFila}>
          <MaterialIcons
            name="shield"
            size={24}
            color={COLORS.primary}
            style={estilos.switchFilaIcono}
            accessibilityElementsHidden
          />
          <View style={estilos.switchFilaText}>
            <Text style={estilos.switchFilaLabel}>Activar mínimo vital (Decreto 776/2025)</Text>
          </View>
          <Switch
            value={aplicaMinimoVital}
            onValueChange={setAplicaMinimoVital}
            disabled={guardando || cargandoInputs}
            accessibilityLabel="Aplicar mínimo vital"
            testID="switch-minimo-vital"
          />
        </View>
        {aplicaMinimoVital && (
          <View style={estilos.campo}>
            <FormField
              label="M³ gratis al inicio del periodo"
              value={m3Gratis}
              onChangeText={setM3Gratis}
              keyboardType="numeric"
              editable={!guardando && !cargandoInputs}
              selectable
              tabularNums
              testID="param-m3gratis"
            />
          </View>
        )}
      </SeccionForm>

      <BotonPrimario
        texto="Guardar Parámetros"
        textoCargando="Guardando…"
        icono="save"
        iconoComponente={<IconoGuardar colorIcono={COLORS.onPrimary} testID="param-guardar-icon" />}
        tono="azul"
        onPress={guardar}
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
  // Mantenemos 'input' por si se agrega algun campo no-FormField en el
  // futuro. Los FormField tienen su propio style interno.
  warningCma: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.error,
    backgroundColor: COLORS.errorContainer ?? COLORS.surfaceContainerLow,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
    minHeight: 44,
  },
  input: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.onSurface,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
});