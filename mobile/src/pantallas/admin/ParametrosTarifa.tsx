/**
 * Pantalla admin: parámetros tarifarios de un prestador por periodo (5 años).
 *
 * Define: cargo fijo, precios por bloque, consumo básico, costos medios
 * (CMA, CMO, CMI, CMT, CMVIAA), IPUF, mínimo vital opcional.
 */
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../theme/skeletal-tokens';
import type { ParametrosTarifa } from '../../dominio/parametros-tarifa/types';

interface Props {
  readonly id_prestador: number;
  readonly parametrosActuales: ParametrosTarifa | null;
  readonly repo: {
    guardar: (p: Omit<ParametrosTarifa, 'id_parametros' | 'created_at'>) => Promise<ParametrosTarifa>;
  };
}

const periodoDefault = (): number => Number(new Date().toISOString().slice(0, 4));

export default function ParametrosTarifaForm({ id_prestador, parametrosActuales, repo }: Props) {
  const [periodo, setPeriodo] = useState(String(parametrosActuales?.periodo ?? periodoDefault()));
  const [cargoFijo, setCargoFijo] = useState(String(parametrosActuales?.cargo_fijo_pesos ?? 15000));
  const [precioBasico, setPrecioBasico] = useState(String(parametrosActuales?.precio_m3_basico ?? 2000));
  const [precioComplementario, setPrecioComplementario] = useState(String(parametrosActuales?.precio_m3_complementario ?? 0));
  const [precioSuntuario, setPrecioSuntuario] = useState(String(parametrosActuales?.precio_m3_suntuario ?? 0));
  const [consumoBasico, setConsumoBasico] = useState(String(parametrosActuales?.consumo_basico_m3 ?? 20));
  const [consumoComplementario, setConsumoComplementario] = useState(String(parametrosActuales?.consumo_complementario_m3 ?? 0));
  const [cma, setCma] = useState(String(parametrosActuales?.cma ?? 0));
  const [cmo, setCmo] = useState(String(parametrosActuales?.cmo ?? 0));
  const [cmi, setCmi] = useState(String(parametrosActuales?.cmi ?? 0));
  const [cmt, setCmt] = useState(String(parametrosActuales?.cmt ?? 0));
  const [cmviaa, setCmviaa] = useState(String(parametrosActuales?.cmviaa ?? 0));
  const [ipuf, setIpuf] = useState(String(parametrosActuales?.ipuf_m3_suscriptor_mes ?? 6));
  const [consumoCorregido, setConsumoCorregido] = useState(String(parametrosActuales?.consumo_corregido_m3_anual ?? 0));
  const [aplicaMinimoVital, setAplicaMinimoVital] = useState(parametrosActuales?.aplica_minimo_vital ?? false);
  const [m3Gratis, setM3Gratis] = useState(String(parametrosActuales?.m3_gratis_minimo_vital ?? 0));
  const [vigenteDesde, setVigenteDesde] = useState(parametrosActuales?.vigente_desde ?? new Date().toISOString().slice(0, 10));
  const [vigenteHasta, setVigenteHasta] = useState(parametrosActuales?.vigente_hasta ?? `${Number(periodoDefault()) + 4}-12-31`);
  const [guardando, setGuardando] = useState(false);

  const num = (s: string): number => {
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await repo.guardar({
        id_prestador,
        id_acuerdo: parametrosActuales?.id_acuerdo ?? 0,
        periodo: num(periodo),
        cargo_fijo_pesos: num(cargoFijo),
        precio_m3_basico: num(precioBasico),
        precio_m3_complementario: num(precioComplementario),
        precio_m3_suntuario: num(precioSuntuario),
        consumo_basico_m3: num(consumoBasico),
        consumo_complementario_m3: num(consumoComplementario),
        cma: num(cma),
        cmo: num(cmo),
        cmi: num(cmi),
        cmt: num(cmt),
        cmviaa: num(cmviaa),
        ipuf_m3_suscriptor_mes: num(ipuf),
        consumo_corregido_m3_anual: num(consumoCorregido),
        aplica_minimo_vital: aplicaMinimoVital,
        m3_gratis_minimo_vital: parseInt(m3Gratis, 10) || 0,
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

      <Text style={estilos.seccion}>Cargo fijo y bloques de consumo</Text>
      <View style={estilos.campo}>
        <Text style={estilos.label}>Cargo fijo ($/mes)</Text>
        <TextInput style={estilos.input} keyboardType="numeric" value={cargoFijo} onChangeText={setCargoFijo} />
      </View>
      <View style={estilos.campo}>
        <Text style={estilos.label}>Precio m³ básico ($)</Text>
        <TextInput style={estilos.input} keyboardType="numeric" value={precioBasico} onChangeText={setPrecioBasico} />
      </View>
      <View style={estilos.campo}>
        <Text style={estilos.label}>Precio m³ complementario ($)</Text>
        <TextInput style={estilos.input} keyboardType="numeric" value={precioComplementario} onChangeText={setPrecioComplementario} />
      </View>
      <View style={estilos.campo}>
        <Text style={estilos.label}>Precio m³ suntuario ($)</Text>
        <TextInput style={estilos.input} keyboardType="numeric" value={precioSuntuario} onChangeText={setPrecioSuntuario} />
      </View>
      <View style={estilos.campo}>
        <Text style={estilos.label}>Consumo básico (m³)</Text>
        <TextInput style={estilos.input} keyboardType="numeric" value={consumoBasico} onChangeText={setConsumoBasico} />
      </View>
      <View style={estilos.campo}>
        <Text style={estilos.label}>Consumo complementario (m³)</Text>
        <TextInput style={estilos.input} keyboardType="numeric" value={consumoComplementario} onChangeText={setConsumoComplementario} />
      </View>

      <Text style={estilos.seccion}>Costos medios (estudio de costos del prestador)</Text>
      {(['cma', 'cmo', 'cmi', 'cmt', 'cmviaa'] as const).map((campo) => {
        const [v, s] = (() => {
          switch (campo) {
            case 'cma': return [cma, setCma];
            case 'cmo': return [cmo, setCmo];
            case 'cmi': return [cmi, setCmi];
            case 'cmt': return [cmt, setCmt];
            case 'cmviaa': return [cmviaa, setCmviaa];
          }
        })() as [string, (s: string) => void];
        const label = { cma: 'CMA · Cargo Medio Administración', cmo: 'CMO · Cargo Medio Operación', cmi: 'CMI · Cargo Medio Inversión', cmt: 'CMT · Cargo Medio Tasas', cmviaa: 'CMVIAA · Inversiones Ambientales Adicionales (907/2019)' }[campo];
        return (
          <View key={campo} style={estilos.campo}>
            <Text style={estilos.label}>{label}</Text>
            <TextInput style={estilos.input} keyboardType="numeric" value={v} onChangeText={s} />
          </View>
        );
      })}

      <Text style={estilos.seccion}>Pérdidas y consumo corregido</Text>
      <View style={estilos.campo}>
        <Text style={estilos.label}>IPUF (m³/suscriptor/mes, estándar 6)</Text>
        <TextInput style={estilos.input} keyboardType="numeric" value={ipuf} onChangeText={setIpuf} />
      </View>
      <View style={estilos.campo}>
        <Text style={estilos.label}>Consumo corregido anual (m³, agregado prestador)</Text>
        <TextInput style={estilos.input} keyboardType="numeric" value={consumoCorregido} onChangeText={setConsumoCorregido} />
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
  titulo: { ...TYPOGRAPHY.titleLg, color: COLORS.onSurface },
  sub: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant, marginBottom: SPACING.md },
  seccion: { ...TYPOGRAPHY.titleSm, color: COLORS.primary, marginTop: SPACING.md },
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
