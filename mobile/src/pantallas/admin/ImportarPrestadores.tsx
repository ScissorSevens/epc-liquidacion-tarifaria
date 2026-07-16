/**
 * Pantalla admin: importación masiva de prestadores rurales desde CSV.
 *
 * Carga 300 prestadores del programa "Agua la Vereda" desde un spreadsheet
 * (CSV con columnas: codigo, nombre, NIT, municipio, departamento, segmento,
 * num_suscriptores_urbanos, num_suscriptores_rurales).
 */
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../theme/skeletal-tokens';

interface Props {
  readonly repo: {
    importarCSV: (csv: string) => Promise<{ insertados: number; errores: Array<{ fila: number; motivo: string }> }>;
  };
}

const CSV_EJEMPLO = `codigo,nombre,NIT,municipio,departamento,segmento,num_suscriptores_urbanos,num_suscriptores_rurales
ACU-001,Asociación Acueducto El Rosal,900123456-1,Facatativá,Cundinamarca,2,0,150
ACU-002,Junta Acueducto La Esperanza,900234567-2,Girardot,Cundinamarca,2,0,80`;

export default function ImportarPrestadores({ repo }: Props) {
  const [csv, setCsv] = useState(CSV_EJEMPLO);
  const [importando, setImportando] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState<{ insertados: number; errores: Array<{ fila: number; motivo: string }> } | null>(null);

  const importar = async () => {
    setImportando(true);
    try {
      const resultado = await repo.importarCSV(csv);
      setUltimoResultado(resultado);
      Alert.alert(
        'Importación completa',
        `Insertados: ${resultado.insertados}\nErrores: ${resultado.errores.length}`,
      );
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setImportando(false);
    }
  };

  return (
    <ScrollView style={estilos.root} contentContainerStyle={estilos.content}>
      <Text style={estilos.titulo}>Importar Prestadores desde CSV</Text>
      <Text style={estilos.sub}>
        Pegue el contenido del CSV con los 300 prestadores vinculados a EPC. El sistema validará
        cada fila y reportará errores sin abortar la importación.
      </Text>

      <View style={estilos.seccion}>
        <Text style={estilos.label}>CSV (formato: codigo, nombre, NIT, municipio, departamento, segmento, num_suscriptores_urbanos, num_suscriptores_rurales)</Text>
        <TextInput
          style={estilos.textarea}
          multiline
          value={csv}
          onChangeText={setCsv}
          textAlignVertical="top"
        />
      </View>

      <Pressable style={[estilos.boton, importando && estilos.botonDisabled]} onPress={importar} disabled={importando}>
        <MaterialIcons name="upload-file" size={20} color={COLORS.onPrimary} />
        <Text style={estilos.botonLabel}>{importando ? 'Importando...' : 'Importar'}</Text>
      </Pressable>

      {ultimoResultado && (
        <View style={estilos.resultado}>
          <Text style={estilos.resultadoHeader}>Último resultado</Text>
          <Text style={estilos.resultadoLinea}>✓ Insertados: {ultimoResultado.insertados}</Text>
          <Text style={estilos.resultadoLinea}>✗ Errores: {ultimoResultado.errores.length}</Text>
          {ultimoResultado.errores.length > 0 && (
            <View style={estilos.listaErrores}>
              {ultimoResultado.errores.slice(0, 20).map((e, i) => (
                <Text key={i} style={estilos.errorLinea}>
                  Fila {e.fila}: {e.motivo}
                </Text>
              ))}
              {ultimoResultado.errores.length > 20 && (
                <Text style={estilos.errorLinea}>... y {ultimoResultado.errores.length - 20} más</Text>
              )}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, gap: SPACING.md },
  titulo: { ...TYPOGRAPHY.headlineLg, color: COLORS.onSurface },
  sub: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant, marginBottom: SPACING.md },
  seccion: { gap: SPACING.xs },
  label: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant },
  textarea: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onSurface,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    minHeight: 240,
    fontFamily: 'monospace',
  },
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.xs,
  },
  botonDisabled: { opacity: 0.5 },
  botonLabel: { ...TYPOGRAPHY.labelLg, color: COLORS.onPrimary },
  resultado: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  resultadoHeader: { ...TYPOGRAPHY.headlineSm, color: COLORS.onSurface, marginBottom: SPACING.xs },
  resultadoLinea: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface },
  listaErrores: { marginTop: SPACING.xs, gap: 2 },
  errorLinea: { ...TYPOGRAPHY.bodySm, color: COLORS.error, fontFamily: 'monospace' },
});
