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
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { BotonPrimario } from '../../componentes/BotonPrimario';
import { FormField } from '../../componentes/FormField';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../theme/skeletal-tokens';
import { useWorkspace } from '../../composicion/useWorkspace';
import { getBootstrap } from '../../composition/get-bootstrap';
import {
  COMPONENTES_TARIFARIOS,
  calcularCargos,
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
  const [cargando, setCargando] = useState(true);

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
      //   `bs.parametrosTarifaRepo as unknown as ParametrosTarifaRepo`
      // (cast inseguro que tapaba el bug `repo.guardar is not a function`
      //  — ver TAREA 11 sdd-apply).
      if (repo === null) setRepo(bs.parametrosTarifaRepo);
      if (acuerdoRepo === null) setAcuerdoRepo(bs.acuerdoMunicipalRepo);
    })();
    return () => { cancelado = true; };
  }, [repo, acuerdoRepo]);

  // Derivar id_acuerdo a partir del acuerdo vigente del prestador activo.
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

  // Cargar parámetros tarifarios vigentes para el prestador activo.
  useEffect(() => {
    if (id_prestador <= 0 || repo === null) return;
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
  }, [repo, id_prestador]);

  const [periodo, setPeriodo] = useState(String(parametrosActuales?.periodo ?? periodoDefault()));
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

  return (
    <ScrollView style={estilos.root} contentContainerStyle={estilos.content}>
      {id_prestador <= 0 || id_acuerdo <= 0 || (repo === null && cargando) ? (
        <Text style={estilos.sub}>Cargando contexto del prestador...</Text>
      ) : null}
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
          editable={!guardando}
          testID="param-periodo"
        />
      </View>
      <View style={estilos.campo}>
        <FormField
          label="Vigente desde (YYYY-MM-DD)"
          value={vigenteDesde}
          onChangeText={setVigenteDesde}
          editable={!guardando}
          accessibilityHint="Fecha de inicio de vigencia del periodo tarifario"
          testID="param-vigente-desde"
        />
      </View>
      <View style={estilos.campo}>
        <FormField
          label="Vigente hasta (YYYY-MM-DD)"
          value={vigenteHasta}
          onChangeText={setVigenteHasta}
          editable={!guardando}
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
          editable={!guardando}
          testID="param-cma"
        />
      </View>
      <View style={estilos.campo}>
        <FormField
          label="CMO · Costo Medio Operación ($/m³)"
          value={cmo}
          onChangeText={setCmo}
          keyboardType="numeric"
          editable={!guardando}
          testID="param-cmo"
        />
      </View>
      <View style={estilos.campo}>
        <FormField
          label="CMI · Costo Medio Inversión ($/m³)"
          value={cmi}
          onChangeText={setCmi}
          keyboardType="numeric"
          editable={!guardando}
          testID="param-cmi"
        />
      </View>
      <View style={estilos.campo}>
        <FormField
          label="CMT · Costo Medio Tasas Ambientales ($/m³)"
          value={cmt}
          onChangeText={setCmt}
          keyboardType="numeric"
          editable={!guardando}
          testID="param-cmt"
        />
      </View>

      <View style={estilos.campoFila}>
        <Text style={estilos.label}>Activar CMVIAA (art. 14 Res 907/2019)</Text>
        <Switch
          value={aplicaCmviaa}
          onValueChange={setAplicaCmviaa}
          disabled={guardando}
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
            editable={!guardando}
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
          editable={!guardando}
          testID="param-agua"
        />
      </View>
      <View style={estilos.campo}>
        <FormField
          label="IPUF (m³/suscriptor/mes, art. 5, estándar 6)"
          value={ipuf}
          onChangeText={setIpuf}
          keyboardType="numeric"
          editable={!guardando}
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
          editable={!guardando}
          testID="param-suscriptores"
        />
      </View>

      <Text style={estilos.seccion}>Mínimo vital (Decreto 776/2025 — opcional)</Text>
      <View style={estilos.campoFila}>
        <Text style={estilos.label}>Activar mínimo vital</Text>
        <Switch
          value={aplicaMinimoVital}
          onValueChange={setAplicaMinimoVital}
          disabled={guardando}
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
            editable={!guardando}
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
        cargando={guardando}
        testID="param-guardar"
      />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, gap: SPACING.sm },
  titulo: { ...TYPOGRAPHY.headlineLg, color: COLORS.onSurface },
  sub: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant, marginBottom: SPACING.md },
  seccion: { ...TYPOGRAPHY.headlineSm, color: COLORS.primary, marginTop: SPACING.md },
  nota: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant, fontStyle: 'italic', marginBottom: SPACING.xs },
  campo: { gap: SPACING.xs },
  campoFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant },
  // Mantenemos 'input' por si se agrega algun campo no-FormField en el
  // futuro. Los FormField tienen su propio style interno.
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