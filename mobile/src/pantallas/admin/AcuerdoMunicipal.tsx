/**
 * Pantalla admin: edición del Acuerdo Municipal de un prestador.
 *
 * Define los topes de subsidio y contribución aprobados por el Concejo
 * Municipal, conforme a Ley 142/1994 art. 99.6.
 *
 * El form valida que los topes NO superen los topes nacionales:
 *   E1 ≤ 60%, E2 ≤ 50%, E3 ≤ 40% (subsidios)
 *   E5 ≤ 50%, E6 ≤ 60%, comercial/industrial ≥ 0 (contribuciones)
 *
 * Commit 6 — FormField migration:
 *   - 9 inputs numericos migrados a FormField (subsidios E1-E3,
 *     contribuciones E5-E6, comercial/industrial, fechas vigencia).
 *   - Validación derivada del callsite via prop error.
 *   - Toques de craft: required asterisk en REQ, accesibilidad, touch target.
 *   - Botón guardar reemplazado por BotonPrimario (CTAs consolidados).
 */
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { BotonPrimario } from '../../componentes/BotonPrimario';
import { FormField } from '../../componentes/FormField';
import { SeccionForm } from '../../componentes/SeccionForm';
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
        setRepo(bs.repos.acuerdoMunicipalRepo as unknown as AcuerdoMunicipalRepo);
      }
    })();
    return () => { cancelado = true; };
  }, [repo]);

  // Cargar acuerdo vigente para el prestador en uso (una sola vez por id_prestador).
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
  // Errores inline por campo (clave = nombre del factor).
  const [errores, setErrores] = useState<Record<string, string | undefined>>({});

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

  const validar = (): boolean => {
    const checks: Array<[string, string, number, number]> = [
      ['E1', factorE1, -1, TOPES_NACIONALES.subs_e1],
      ['E2', factorE2, -1, TOPES_NACIONALES.subs_e2],
      ['E3', factorE3, -1, TOPES_NACIONALES.subs_e3],
      ['E5', factorE5, 0, TOPES_NACIONALES.contr_e5],
      ['E6', factorE6, 0, TOPES_NACIONALES.contr_e6],
      ['Comercial', factorComercial, 0, 1],
      ['Industrial', factorIndustrial, 0, 1],
    ];
    const nuevosErrores: Record<string, string> = {};
    for (const [estrato, valorStr, min, max] of checks) {
      const valor = parseFloat(valorStr);
      if (Number.isNaN(valor)) {
        nuevosErrores[estrato] = `${estrato}: valor no numérico`;
        continue;
      }
      if (valor < min) {
        nuevosErrores[estrato] = `${estrato}: factor no puede ser < ${min}`;
        continue;
      }
      if (valor > max) {
        nuevosErrores[estrato] = `${estrato}: factor ${valor} supera tope legal ${max} (Ley 142/1994 art. 99.6)`;
      }
    }
    if (vigenteDesde > vigenteHasta) {
      nuevosErrores['vigencia'] = 'Vigencia: fecha desde posterior a fecha hasta';
    }
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const guardar = async () => {
    if (repo === null) {
      Alert.alert('Error', 'El repositorio aún no está listo. Esperá un instante.');
      return;
    }
    if (!validar()) {
      Alert.alert('Validación', 'Revisá los campos marcados');
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

      <SeccionForm titulo="Subsidios por estrato (negativos)">
        <View style={estilos.campo}>
          <FormField
            label="Estrato E1 (≤ 60% de subsidio)"
            value={factorE1}
            onChangeText={setFactorE1}
            error={errores['E1']}
            keyboardType="numeric"
            editable={!guardando}
            accessibilityHint="Factor de subsidio para estrato 1, valor negativo entre -1 y -0.60"
            testID="acuerdo-e1"
          />
        </View>
        <View style={estilos.campo}>
          <FormField
            label="Estrato E2 (≤ 50% de subsidio)"
            value={factorE2}
            onChangeText={setFactorE2}
            error={errores['E2']}
            keyboardType="numeric"
            editable={!guardando}
            accessibilityHint="Factor de subsidio para estrato 2, valor negativo entre -1 y -0.50"
            testID="acuerdo-e2"
          />
        </View>
        <View style={estilos.campo}>
          <FormField
            label="Estrato E3 (≤ 40% de subsidio)"
            value={factorE3}
            onChangeText={setFactorE3}
            error={errores['E3']}
            keyboardType="numeric"
            editable={!guardando}
            accessibilityHint="Factor de subsidio para estrato 3, valor negativo entre -1 y -0.40"
            testID="acuerdo-e3"
          />
        </View>
      </SeccionForm>

      <SeccionForm titulo="Contribuciones por estrato (positivas)">
        <View style={estilos.campo}>
          <FormField
            label="Estrato E5 (≤ 50% de contribución)"
            value={factorE5}
            onChangeText={setFactorE5}
            error={errores['E5']}
            keyboardType="numeric"
            editable={!guardando}
            accessibilityHint="Factor de contribución para estrato 5, valor positivo entre 0 y 0.50"
            testID="acuerdo-e5"
          />
        </View>
        <View style={estilos.campo}>
          <FormField
            label="Estrato E6 (≤ 60% de contribución)"
            value={factorE6}
            onChangeText={setFactorE6}
            error={errores['E6']}
            keyboardType="numeric"
            editable={!guardando}
            accessibilityHint="Factor de contribución para estrato 6, valor positivo entre 0 y 0.60"
            testID="acuerdo-e6"
          />
        </View>
      </SeccionForm>

      <SeccionForm titulo="Contribuciones por categoría de uso">
        <View style={estilos.campo}>
          <FormField
            label="Comercial (0 a 100%)"
            value={factorComercial}
            onChangeText={setFactorComercial}
            error={errores['Comercial']}
            keyboardType="numeric"
            editable={!guardando}
            testID="acuerdo-comercial"
          />
        </View>
        <View style={estilos.campo}>
          <FormField
            label="Industrial (0 a 100%)"
            value={factorIndustrial}
            onChangeText={setFactorIndustrial}
            error={errores['Industrial']}
            keyboardType="numeric"
            editable={!guardando}
            testID="acuerdo-industrial"
          />
        </View>
      </SeccionForm>

      <SeccionForm titulo="Vigencia">
        <View style={estilos.campo}>
          <FormField
            label="Desde (YYYY-MM-DD)"
            value={vigenteDesde}
            onChangeText={setVigenteDesde}
            error={errores['vigencia']}
            editable={!guardando}
            accessibilityHint="Fecha de inicio de vigencia, formato AAAA-MM-DD"
            testID="acuerdo-vigente-desde"
          />
        </View>
        <View style={estilos.campo}>
          <FormField
            label="Hasta (YYYY-MM-DD)"
            value={vigenteHasta}
            onChangeText={setVigenteHasta}
            editable={!guardando}
            accessibilityHint="Fecha de fin de vigencia, formato AAAA-MM-DD"
            testID="acuerdo-vigente-hasta"
          />
        </View>
      </SeccionForm>

      <BotonPrimario
        texto="Guardar Acuerdo"
        textoCargando="Guardando…"
        icono="save"
        tono="azul"
        onPress={guardar}
        cargando={guardando}
        testID="acuerdo-guardar"
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
  campo: { gap: SPACING.xs },
  // Mantenemos 'label' y 'input' por si se agrega algun campo no-FormField
  // en el futuro. Los FormField tienen su propio style interno.
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
});