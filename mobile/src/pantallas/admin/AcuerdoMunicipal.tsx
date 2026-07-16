/**
 * Pantalla admin: edición del Acuerdo Municipal de un prestador.
 *
 * Define los topes de subsidio y contribución aprobados por el Concejo
 * Municipal, conforme a Ley 142/1994 art. 99.6.
 *
 * El form valida que los topes NO superen los topes nacionales:
 *   E1 ≤ 60%, E2 ≤ 50%, E3 ≤ 40% (subsidios)
 *   E5 ≤ 50%, E6 ≤ 60%, comercial/industrial ≥ 0 (contribuciones)
 */
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../theme/skeletal-tokens';
import { useWorkspace } from '../../composicion/useWorkspace';
import { getBootstrap } from '../../composition/get-bootstrap';
import type { AcuerdoMunicipal } from '../../../dominio/acuerdo-municipal/types';

interface AcuerdoMunicipalRepo {
  readonly guardar: (a: Omit<AcuerdoMunicipal, 'id_acuerdo' | 'created_at'>) => Promise<AcuerdoMunicipal>;
  readonly buscarVigente: (id_prestador: number, fecha: string) => Promise<AcuerdoMunicipal | null>;
}

interface Props {
  /** Si no se provee, se toma del workspace (`useWorkspace.id_prestador_activo`). */
  readonly id_prestador?: number;
  /** Si no se provee, se busca via `repo.buscarVigente()` con la fecha actual. */
  readonly acuerdoActual?: AcuerdoMunicipal | null;
  /** Si no se provee, se resuelve via `getBootstrap()` (patrón del resto del código). */
  readonly repo?: AcuerdoMunicipalRepo;
}

const TOPES_NACIONALES = {
  subs_e1: -0.60,
  subs_e2: -0.50,
  subs_e3: -0.40,
  contr_e5: 0.50,
  contr_e6: 0.60,
};

export default function AcuerdoMunicipalForm({
  id_prestador: idProp,
  acuerdoActual: acuerdoProp,
  repo: repoProp,
}: Props) {
  // PER-05: selector específico. Suscripción limitada a id_prestador_activo
  // (único campo del store que este componente lee). Cambios en
  // acuerdo_vigente, parametros_vigentes, prestadores_disponibles,
  // cargando o prestador NO causan re-render.
  const id_prestador_activo = useWorkspace((s) => s.id_prestador_activo);
  const id_prestador = idProp ?? id_prestador_activo;
  const [repo, setRepo] = useState<AcuerdoMunicipalRepo | null>(repoProp ?? null);
  const [acuerdoActual, setAcuerdoActual] = useState<AcuerdoMunicipal | null>(acuerdoProp ?? null);
  const [cargando, setCargando] = useState(true);

  // Resolver repo internamente si no vino inyectado desde el Stack.
  useEffect(() => {
    if (repo !== null) return;
    let cancelado = false;
    void (async () => {
      const bs = await getBootstrap();
      if (!cancelado) {
        setRepo(bs.acuerdoMunicipalRepo as unknown as AcuerdoMunicipalRepo);
      }
    })();
    return () => { cancelado = true; };
  }, [repo]);

  // Cargar acuerdo vigente para el prestador activo (una sola vez por id_prestador).
  useEffect(() => {
    if (id_prestador <= 0 || repo === null) return;
    let cancelado = false;
    void (async () => {
      setCargando(true);
      try {
        const acuerdo = await repo.buscarVigente(id_prestador, new Date().toISOString());
        if (!cancelado) {
          setAcuerdoActual(acuerdo);
          setCargando(false);
        }
      } catch {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [repo, id_prestador]);

  const [factorE1, setFactorE1] = useState(String(acuerdoActual?.factor_subsidio_e1 ?? TOPES_NACIONALES.subs_e1));
  const [factorE2, setFactorE2] = useState(String(acuerdoActual?.factor_subsidio_e2 ?? TOPES_NACIONALES.subs_e2));
  const [factorE3, setFactorE3] = useState(String(acuerdoActual?.factor_subsidio_e3 ?? TOPES_NACIONALES.subs_e3));
  const [factorE5, setFactorE5] = useState(String(acuerdoActual?.factor_contribucion_e5 ?? TOPES_NACIONALES.contr_e5));
  const [factorE6, setFactorE6] = useState(String(acuerdoActual?.factor_contribucion_e6 ?? TOPES_NACIONALES.contr_e6));
  const [factorComercial, setFactorComercial] = useState(String(acuerdoActual?.factor_contribucion_comercial ?? 0.50));
  const [factorIndustrial, setFactorIndustrial] = useState(String(acuerdoActual?.factor_contribucion_industrial ?? 0.30));
  const [vigenteDesde, setVigenteDesde] = useState(acuerdoActual?.fecha_vigencia_desde ?? new Date().toISOString().slice(0, 10));
  const [vigenteHasta, setVigenteHasta] = useState(acuerdoActual?.fecha_vigencia_hasta ?? `${new Date().getFullYear() + 4}-12-31`);
  const [guardando, setGuardando] = useState(false);

  /**
   * Sincroniza los inputs con el acuerdoActual UNA vez al recibirlo desde el
   * repo. Sin este useEffect, los inputs quedan inicializados con TOPES_NACIONALES
   * (porque el primer render ocurre antes del load async) y no se actualizarían
   * al llegar los datos del prestador. El flag `sincronizado` previene que se
   * sobreescriban ediciones del usuario.
   */
  const [sincronizado, setSincronizado] = useState(acuerdoProp !== undefined);
  useEffect(() => {
    if (sincronizado || acuerdoActual === null) return;
    setFactorE1(String(acuerdoActual.factor_subsidio_e1 ?? TOPES_NACIONALES.subs_e1));
    setFactorE2(String(acuerdoActual.factor_subsidio_e2 ?? TOPES_NACIONALES.subs_e2));
    setFactorE3(String(acuerdoActual.factor_subsidio_e3 ?? TOPES_NACIONALES.subs_e3));
    setFactorE5(String(acuerdoActual.factor_contribucion_e5 ?? TOPES_NACIONALES.contr_e5));
    setFactorE6(String(acuerdoActual.factor_contribucion_e6 ?? TOPES_NACIONALES.contr_e6));
    setFactorComercial(String(acuerdoActual.factor_contribucion_comercial ?? 0.50));
    setFactorIndustrial(String(acuerdoActual.factor_contribucion_industrial ?? 0.30));
    setVigenteDesde(acuerdoActual.fecha_vigencia_desde ?? new Date().toISOString().slice(0, 10));
    setVigenteHasta(acuerdoActual.fecha_vigencia_hasta ?? `${new Date().getFullYear() + 4}-12-31`);
    setSincronizado(true);
  }, [acuerdoActual, sincronizado]);

  const validar = (): string | null => {
    const checks: Array<[string, number, number, number]> = [
      ['E1', parseFloat(factorE1), -1, TOPES_NACIONALES.subs_e1],
      ['E2', parseFloat(factorE2), -1, TOPES_NACIONALES.subs_e2],
      ['E3', parseFloat(factorE3), -1, TOPES_NACIONALES.subs_e3],
      ['E5', parseFloat(factorE5), 0, TOPES_NACIONALES.contr_e5],
      ['E6', parseFloat(factorE6), 0, TOPES_NACIONALES.contr_e6],
      ['Comercial', parseFloat(factorComercial), 0, 1],
      ['Industrial', parseFloat(factorIndustrial), 0, 1],
    ];
    for (const [estrato, valor, min, max] of checks) {
      if (isNaN(valor)) return `${estrato}: valor no numérico`;
      if (valor < min) return `${estrato}: factor no puede ser < ${min}`;
      if (valor > max) return `${estrato}: factor ${valor} supera tope legal ${max} (Ley 142/1994 art. 99.6)`;
    }
    if (vigenteDesde > vigenteHasta) return 'Vigencia: fecha desde posterior a fecha hasta';
    return null;
  };

  const guardar = async () => {
    if (repo === null) {
      Alert.alert('Error', 'El repositorio aún no está listo. Esperá un instante.');
      return;
    }
    const err = validar();
    if (err) {
      Alert.alert('Validación', err);
      return;
    }
    setGuardando(true);
    try {
      await repo.guardar({
        id_prestador,
        factor_subsidio_e1: parseFloat(factorE1),
        factor_subsidio_e2: parseFloat(factorE2),
        factor_subsidio_e3: parseFloat(factorE3),
        factor_contribucion_e5: parseFloat(factorE5),
        factor_contribucion_e6: parseFloat(factorE6),
        factor_contribucion_comercial: parseFloat(factorComercial),
        factor_contribucion_industrial: parseFloat(factorIndustrial),
        fecha_vigencia_desde: vigenteDesde,
        fecha_vigencia_hasta: vigenteHasta,
        acto_administrativo_url: null,
        observaciones: null,
      });
      Alert.alert('Éxito', 'Acuerdo Municipal guardado correctamente');
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ScrollView style={estilos.root} contentContainerStyle={estilos.content}>
      {id_prestador <= 0 || (repo === null && cargando) ? (
        <Text style={estilos.sub}>Cargando contexto del prestador...</Text>
      ) : null}
      <Text style={estilos.titulo}>Acuerdo Municipal · Prestador #{id_prestador}</Text>
      <Text style={estilos.sub}>
        Topes conforme a Ley 142/1994 art. 99.6
      </Text>

      <Text style={estilos.seccion}>Subsidios por estrato (negativos)</Text>
      {(['E1', 'E2', 'E3'] as const).map((estrato, idx) => {
        const [v, s] = [parseFloat([factorE1, factorE2, factorE3][idx]), [setFactorE1, setFactorE2, setFactorE3][idx]];
        const tope = [TOPES_NACIONALES.subs_e1, TOPES_NACIONALES.subs_e2, TOPES_NACIONALES.subs_e3][idx];
        return (
          <View key={estrato} style={estilos.campo}>
            <Text style={estilos.label}>Estrato {estrato} (≤ {Math.abs(tope) * 100}%)</Text>
            <TextInput
              style={[estilos.input, v < tope && estilos.inputError]}
              keyboardType="numeric"
              value={[factorE1, factorE2, factorE3][idx]}
              onChangeText={s}
            />
          </View>
        );
      })}

      <Text style={estilos.seccion}>Contribuciones por estrato (positivas)</Text>
      {(['E5', 'E6'] as const).map((estrato, idx) => {
        const [v, s] = [parseFloat([factorE5, factorE6][idx]), [setFactorE5, setFactorE6][idx]];
        const tope = [TOPES_NACIONALES.contr_e5, TOPES_NACIONALES.contr_e6][idx];
        return (
          <View key={estrato} style={estilos.campo}>
            <Text style={estilos.label}>Estrato {estrato} (≤ {tope * 100}%)</Text>
            <TextInput
              style={[estilos.input, v > tope && estilos.inputError]}
              keyboardType="numeric"
              value={[factorE5, factorE6][idx]}
              onChangeText={s}
            />
          </View>
        );
      })}

      <Text style={estilos.seccion}>Contribuciones por categoría de uso</Text>
      <View style={estilos.campo}>
        <Text style={estilos.label}>Comercial (0 a 100%)</Text>
        <TextInput style={estilos.input} keyboardType="numeric" value={factorComercial} onChangeText={setFactorComercial} />
      </View>
      <View style={estilos.campo}>
        <Text style={estilos.label}>Industrial (0 a 100%)</Text>
        <TextInput style={estilos.input} keyboardType="numeric" value={factorIndustrial} onChangeText={setFactorIndustrial} />
      </View>

      <Text style={estilos.seccion}>Vigencia</Text>
      <View style={estilos.campo}>
        <Text style={estilos.label}>Desde (YYYY-MM-DD)</Text>
        <TextInput style={estilos.input} value={vigenteDesde} onChangeText={setVigenteDesde} />
      </View>
      <View style={estilos.campo}>
        <Text style={estilos.label}>Hasta (YYYY-MM-DD)</Text>
        <TextInput style={estilos.input} value={vigenteHasta} onChangeText={setVigenteHasta} />
      </View>

      <Pressable style={[estilos.boton, guardando && estilos.botonDisabled]} onPress={guardar} disabled={guardando}>
        <MaterialIcons name="save" size={20} color={COLORS.onPrimary} />
        <Text style={estilos.botonLabel}>{guardando ? 'Guardando...' : 'Guardar Acuerdo'}</Text>
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
  campo: { gap: SPACING.xs },
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
  inputError: { borderColor: COLORS.error, borderWidth: 2 },
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
