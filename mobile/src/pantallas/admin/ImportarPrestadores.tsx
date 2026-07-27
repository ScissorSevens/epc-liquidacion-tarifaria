/**
 * Pantalla admin: importación masiva de prestadores rurales desde CSV.
 *
 * Carga 300 prestadores del programa "Agua la Vereda" desde un spreadsheet
 * (CSV con columnas: codigo, nombre, NIT, municipio, departamento, segmento,
 * num_suscriptores_urbanos, num_suscriptores_rurales).
 */
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../theme/skeletal-tokens';
import { BotonPrimario } from '../../componentes/BotonPrimario';
import { getBootstrap } from '../../composition/get-bootstrap';
import type { PrestadorRepositoryExpoSqlite } from '../../persistencia/expo-sqlite/prestador-repository-expo-sqlite';

/**
 * Shape del repo que la pantalla necesita. `importarCSV` aún no está en el
 * `PrestadorRepositoryExpoSqlite` del dominio (es feature futura del módulo
 * admin). Resolvemos via `getBootstrap()` y casteamos a este shape — cast
 * tipado (no `as any`), localizado a esta pantalla admin.
 */
interface ImportarPrestadoresRepo {
  readonly importarCSV: (csv: string) => Promise<{
    insertados: number;
    errores: Array<{ fila: number; motivo: string }>;
  }>;
}

interface Props {
  /** Si no se provee, se resuelve via `getBootstrap()` (patrón del resto del código). */
  readonly repo?: ImportarPrestadoresRepo;
}

const CSV_EJEMPLO = `codigo,nombre,NIT,municipio,departamento,segmento,num_suscriptores_urbanos,num_suscriptores_rurales
ACU-001,Asociación Acueducto El Rosal,900123456-1,Facatativá,Cundinamarca,2,0,150
ACU-002,Junta Acueducto La Esperanza,900234567-2,Girardot,Cundinamarca,2,0,80`;

export default function ImportarPrestadores({ repo: repoProp }: Props) {
  const [repo, setRepo] = useState<ImportarPrestadoresRepo | null>(repoProp ?? null);
  const [csv, setCsv] = useState(CSV_EJEMPLO);
  const [importando, setImportando] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState<{ insertados: number; errores: Array<{ fila: number; motivo: string }> } | null>(null);

  // Resolver repo internamente si no vino inyectado desde el Stack.
  useEffect(() => {
    if (repo !== null) return;
    let cancelado = false;
    void (async () => {
      const bs = await getBootstrap();
      if (cancelado) return;
      const prestadorRepo = bs.prestadorRepo as unknown as PrestadorRepositoryExpoSqlite & ImportarPrestadoresRepo;
      setRepo(prestadorRepo);
    });
    return () => { cancelado = true; };
  }, [repo]);

  const importar = async () => {
    if (repo === null) {
      Alert.alert('Error', 'El repositorio aún no está listo. Esperá un instante.');
      return;
    }
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

      <BotonPrimario
        texto="Importar"
        textoCargando="Importando…"
        icono="upload-file"
        tono="azul"
        onPress={importar}
        cargando={importando}
      />

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
  // El botón "Importar" se renderiza via <BotonPrimario> extraído.
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
