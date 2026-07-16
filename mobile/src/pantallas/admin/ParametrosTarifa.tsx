/**
 * Pantalla admin: parámetros tarifarios de un prestador por periodo (5 años).
 *
 * Edita los insumos del motor tarifario según Res CRA 825/2017 (art. 9-10) +
 * 907/2019 (art. 14): costos medios (CMA, CMO, CMI, CMT, CMVIAA), agua
 * (AS, IPUF, N), mínimo vital opcional.
 *
 * Multi-tenant: cada prestador tiene sus ParametrosTarifa (1 vigente
 * por periodo). El motor usa estos insumos + AcuerdoMunicipal.
 */
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../theme/skeletal-tokens';
import { useWorkspace } from '../../composicion/useWorkspace';
import { getBootstrap } from '../../composition/get-bootstrap';
import type { ParametrosTarifa } from '../../../dominio/parametros-tarifa/types';

interface ParametrosTarifaRepo {
  readonly guardar: (p: Omit<ParametrosTarifa, 'id_parametros' | 'created_at'>) => Promise<ParametrosTarifa>;
  readonly buscarVigente: (id_prestador: number, fecha: string) => Promise<ParametrosTarifa | null>;
}

interface AcuerdoRepo {
  readonly buscarVigente: (id_prestador: number, fecha: string) => Promise<{ id_acuerdo: number } | null>;
}

interface Props {
  /** Si no se provee, se toma del workspace (`useWorkspace.id_prestador_activo`). */
  readonly id_prestador?: number;
  /** Si no se provee, se busca via `acuerdoRepo.buscarVigente()` con la fecha actual. */
  readonly id_acuerdo?: number;
  /** Si no se provee, se busca via `repo.buscarVigente()` con la fecha actual. */
  readonly parametrosActuales?: ParametrosTarifa | null;
  /** Si no se provee, se resuelve via `getBootstrap()` (patrón del resto del código). */
  readonly repo?: ParametrosTarifaRepo;
  /** Si no se provee, se resuelve via `getBootstrap()` (requerido para derivar id_acuerdo). */
  readonly acuerdoRepo?: AcuerdoRepo;
}

const periodoDefault = (): number => Number(new Date().toISOString().slice(0, 4));

export default function ParametrosTarifaForm({
  id_prestador: idProp,
  id_acuerdo: idAcuerdoProp,
  parametrosActuales: parametrosProp,
  repo: repoProp,
  acuerdoRepo: acuerdoRepoProp,
}: Props) {
  const { id_prestador_activo } = useWorkspace();
  const id_prestador = idProp ?? id_prestador_activo;
  const [repo, setRepo] = useState<ParametrosTarifaRepo | null>(repoProp ?? null);
  const [acuerdoRepo, setAcuerdoRepo] = useState<AcuerdoRepo | null>(acuerdoRepoProp ?? null);
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
      if (repo === null) setRepo(bs.parametrosTarifaRepo as unknown as ParametrosTarifaRepo);
      if (acuerdoRepo === null) setAcuerdoRepo(bs.acuerdoMunicipalRepo as unknown as AcuerdoRepo);
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
      await repo.guardar({
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
        vigente_desde: vigenteDesde,
        vigente_hasta: vigenteHasta,
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
        <Text style={estilos.label}>Periodo (año tarifario, 5 años)</Text>
        <TextInput style={estilos.input} keyboardType="numeric" value={periodo} onChangeText={setPeriodo} />
      </View>
      <View style={estilos.campo}>
        <Text style={estilos.label}>Vigente desde (YYYY-MM-DD)</Text>
        <TextInput style={estilos.input} value={vigenteDesde} onChangeText={setVigenteDesde} />
      </View>
      <View style={estilos.campo}>
        <Text style={estilos.label}>Vigente hasta (YYYY-MM-DD)</Text>
        <TextInput style={estilos.input} value={vigenteHasta} onChangeText={setVigenteHasta} />
      </View>

      <Text style={estilos.seccion}>Costos medios (estudio de costos del prestador)</Text>
      <Text style={estilos.nota}>Estos son los insumos de la fórmula normativa. El motor NO acepta inputs planos.</Text>
      <View style={estilos.campo}>
        <Text style={estilos.label}>CMA · Costo Medio Administración ($/año, art. 9)</Text>
        <TextInput style={estilos.input} keyboardType="numeric" value={cma} onChangeText={setCma} />
      </View>
      <View style={estilos.campo}>
        <Text style={estilos.label}>CMO · Costo Medio Operación ($/m³)</Text>
        <TextInput style={estilos.input} keyboardType="numeric" value={cmo} onChangeText={setCmo} />
      </View>
      <View style={estilos.campo}>
        <Text style={estilos.label}>CMI · Costo Medio Inversión ($/m³)</Text>
        <TextInput style={estilos.input} keyboardType="numeric" value={cmi} onChangeText={setCmi} />
      </View>
      <View style={estilos.campo}>
        <Text style={estilos.label}>CMT · Costo Medio Tasas Ambientales ($/m³)</Text>
        <TextInput style={estilos.input} keyboardType="numeric" value={cmt} onChangeText={setCmt} />
      </View>

      <View style={estilos.campoFila}>
        <Text style={estilos.label}>Activar CMVIAA (art. 14 Res 907/2019)</Text>
        <Switch value={aplicaCmviaa} onValueChange={setAplicaCmviaa} />
      </View>
      {aplicaCmviaa && (
        <View style={estilos.campo}>
          <Text style={estilos.label}>CMVIAA · Costo Medio Variable Inv. Ambientales Adicionales ($/m³)</Text>
          <TextInput style={estilos.input} keyboardType="numeric" value={cmviaa} onChangeText={setCmviaa} />
        </View>
      )}

      <Text style={estilos.seccion}>Agua y suscriptores (insumo ASP = AS - IPUF×12×N)</Text>
      <View style={estilos.campo}>
        <Text style={estilos.label}>Agua Suministrada año base (m³/año)</Text>
        <TextInput style={estilos.input} keyboardType="numeric" value={aguaSuministrada} onChangeText={setAguaSuministrada} />
      </View>
      <View style={estilos.campo}>
        <Text style={estilos.label}>IPUF (m³/suscriptor/mes, art. 5, estándar 6)</Text>
        <TextInput style={estilos.input} keyboardType="numeric" value={ipuf} onChangeText={setIpuf} />
      </View>
      <View style={estilos.campo}>
        <Text style={estilos.label}>Suscriptores promedio (N) — divisor de CF = CMA/N</Text>
        <TextInput style={estilos.input} keyboardType="numeric" value={suscriptoresPromedio} onChangeText={setSuscriptoresPromedio} />
      </View>

      <Text style={estilos.seccion}>Mínimo vital (Decreto 776/2025 — opcional)</Text>
      <View style={estilos.campoFila}>
        <Text style={estilos.label}>Activar mínimo vital</Text>
        <Switch value={aplicaMinimoVital} onValueChange={setAplicaMinimoVital} />
      </View>
      {aplicaMinimoVital && (
        <View style={estilos.campo}>
          <Text style={estilos.label}>M³ gratis al inicio del periodo</Text>
          <TextInput style={estilos.input} keyboardType="numeric" value={m3Gratis} onChangeText={setM3Gratis} />
        </View>
      )}

      <Pressable style={[estilos.boton, guardando && estilos.botonDisabled]} onPress={guardar} disabled={guardando}>
        <MaterialIcons name="save" size={20} color={COLORS.onPrimary} />
        <Text style={estilos.botonLabel}>{guardando ? 'Guardando...' : 'Guardar Parámetros'}</Text>
      </Pressable>
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
  input: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.onSurface,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.xs,
    marginTop: SPACING.lg,
  },
  botonDisabled: { opacity: 0.5 },
  botonLabel: { ...TYPOGRAPHY.labelLg, color: COLORS.onPrimary },
});
