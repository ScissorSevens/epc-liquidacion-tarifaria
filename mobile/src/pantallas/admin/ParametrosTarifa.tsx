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
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { BotonPrimario } from '../../componentes/BotonPrimario';
import { FormField } from '../../componentes/FormField';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../theme/skeletal-tokens';
import { useWorkspace } from '../../composicion/useWorkspace';
import { getBootstrap } from '../../composition/get-bootstrap';
import {
  COMPONENTES_TARIFARIOS,
  CMA_MINIMO_ACUEDUCTO,
  CMA_MINIMO_ALCANTARILLADO,
  calcularCargos,
  validarCmaMinimo,
  type ParametrosTarifa,
  type ParametrosTarifaRepository,
} from '../../../dominio/parametros-tarifa';
import type { AcuerdoMunicipalRepository } from '../../../dominio/acuerdo-municipal';

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
 * TITULO_FONT_SIZE_CLAMP — H1 clamp del título del screen.
 *
 * Simula `clamp(1.5rem, 3vw, 2.25rem)` de CSS en runtime React Native.
 * Rango efectivo: 24 px (1.5rem) a 36 px (2.25rem). El preferred 3vw
 * se computa contra el ancho de pantalla — al frame default de jest
 * (320×568) cae en el piso (24 px) sin overflow.
 *
 * admin-parametros-tarifa-redesign Task 1 — impeccable craft typography.
 */
const TITULO_FONT_SIZE_CLAMP = ((): number => {
  const { width } = Dimensions.get('window');
  const minimo = 24; // 1.5rem
  const maximo = 36; // 2.25rem
  const preferido = width * 0.03; // 3vw
  return Math.min(Math.max(minimo, preferido), maximo);
})();

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

  const guardar = async () => {
    if (repo === null) {
      Alert.alert('Error', 'El repositorio aún no está listo. Esperá un instante.');
      return;
    }
    setGuardando(true);
    try {
      const componentesActivos = (() => {
        const todos: string[] = [...COMPONENTES_TARIFARIOS];
        if (!aplicaCmviaa) {
          return todos.filter((c) => c !== 'CMVIAA');
        }
        return todos;
      })();
      // Pre-calculamos cargo_fijo_resultante + cargo_consumo_resultante con
      // los valores del formulario (SIN id_parametros/created_at — la
      // factoría pura los ignora). Ver `calcularCargos` en
      // dominio/parametros-tarifa/calcular.ts.
      const borradorCargos: Omit<ParametrosTarifa, 'id_parametros' | 'created_at'> = {
        id_prestador,
        id_acuerdo,
        periodo: entero(periodo),
        cma: num(cma),
        cmo: num(cmo),
        cmi: num(cmi),
        cmt: num(cmt),
        cmviaa: num(cmviaa),
        aplica_cmviaa: aplicaCmviaa,
        agua_suministrada_m3_anio: num(aguaSuministrada),
        ipuf_m3_suscriptor_mes: num(ipuf),
        suscriptores_promedio: entero(suscriptoresPromedio),
        aplica_minimo_vital: aplicaMinimoVital,
        m3_gratis_minimo_vital: entero(m3Gratis),
        ipuf_indice: 1.0,
        componentes_aplicables: componentesActivos,
        minimo_vital: null,
        vigente_desde: vigenteDesde,
        vigente_hasta: vigenteHasta,
        cargo_fijo_resultante: 0,
        cargo_consumo_resultante: 0,
        // Res CRA 825/2017 Art. 7 (anio_base) + Art. 11 (factor IPC).
        anio_base: entero(anioBase),
        factor_indexacion_ipc: 1.0,
      };
      const cargos = calcularCargos(borradorCargos as ParametrosTarifa);
      await repo.guardar({
        ...borradorCargos,
        cargo_fijo_resultante: cargos.cargo_fijo,
        cargo_consumo_resultante: cargos.cargo_consumo,
      });
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

  return (
    <ScrollView style={estilos.root} contentContainerStyle={estilos.content}>
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
      <Text style={estilos.titulo}>Parámetros Tarifarios · Prestador #{id_prestador}</Text>
      <Text style={estilos.sub}>Conforme a Res CRA 825/2017 + 907/2019 art. 14</Text>

      <Text style={estilos.seccion}>Periodo y vigencia</Text>
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
          testID="param-vigente-hasta"
        />
      </View>

      <Text style={estilos.seccion}>Costos medios (estudio de costos del prestador)</Text>
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
          testID="param-cma"
        />
      </View>
      {num(cma) < CMA_MINIMO_ACUEDUCTO && (
        <Text style={estilos.warningCma} testID="param-cma-warning">
          CMA bajo el minimo normativo (Res CRA 825 Art. 15): minimo acueducto = ${CMA_MINIMO_ACUEDUCTO}, alcantarillado = ${CMA_MINIMO_ALCANTARILLADO}. Recomendamos ajustar antes de guardar.
        </Text>
      )}
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
        <Text style={estilos.label}>Activar CMVIAA (art. 14 Res 907/2019)</Text>
        <Switch
          value={aplicaCmviaa}
          onValueChange={setAplicaCmviaa}
          disabled={guardando || cargandoInputs}
          accessibilityLabel="Aplicar costo medio variable de inversión ambiental"
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

      <Text style={estilos.seccion}>Agua y suscriptores (insumo ASP = AS - IPUF×12×N)</Text>
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
          testID="param-suscriptores"
        />
      </View>

      <Text style={estilos.seccion}>Mínimo vital (Decreto 776/2025 — opcional)</Text>
      <View style={estilos.campoFila}>
        <Text style={estilos.label}>Activar mínimo vital</Text>
        <Switch
          value={aplicaMinimoVital}
          onValueChange={setAplicaMinimoVital}
          disabled={guardando || cargandoInputs}
          accessibilityLabel="Aplicar mínimo vital"
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

      <BotonPrimario
        texto="Guardar Parámetros"
        textoCargando="Guardando…"
        icono="save"
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
  // H1 clamp: fontSize entre 24 y 36 px efectivo (clamp 1.5rem .. 2.25rem).
  // Computado en TITULO_FONT_SIZE_CLAMP respetando el viewport real.
  titulo: {
    ...TYPOGRAPHY.headlineLg,
    color: COLORS.onSurface,
    fontSize: TITULO_FONT_SIZE_CLAMP,
    lineHeight: TITULO_FONT_SIZE_CLAMP * 1.2,
  },
  sub: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant, marginBottom: SPACING.md },
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