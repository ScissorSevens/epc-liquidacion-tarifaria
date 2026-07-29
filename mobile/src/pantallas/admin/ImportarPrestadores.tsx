/**
 * Pantalla admin: importación masiva de prestadores rurales desde CSV.
 *
 * Carga 300 prestadores del programa "Agua la Vereda" desde un spreadsheet
 * (CSV con columnas: codigo, nombre, NIT, municipio, departamento, segmento,
 * num_suscriptores_urbanos, num_suscriptores_rurales).
 *
 * Commit 6 — FormField migration:
 *   - El textarea CSV migrado a FormField con multiline=true.
 *   - Sin required (no es required propiamente: el usuario puede pegar
 *     un CSV vacio y el repo mostrara 0 inserts).
 *   - Helper text explica el formato esperado.
 *   - Botón "Importar" sigue via BotonPrimario (ya consolidado en commit
 *     previo `3aa110d`).
 */
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../theme/skeletal-tokens';
import { BotonPrimario } from '../../componentes/BotonPrimario';
import { FormField } from '../../componentes/FormField';
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
      const prestadorRepo = bs.repos.prestadorRepo as unknown as PrestadorRepositoryExpoSqlite & ImportarPrestadoresRepo;
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

      <FormField
        label="CSV"
        value={csv}
        onChangeText={setCsv}
        multiline
        numberOfLines={10}
        editable={!importando}
        helperText="Formato: codigo, nombre, NIT, municipio, departamento, segmento, num_suscriptores_urbanos, num_suscriptores_rurales"
        accessibilityHint="Pegue el contenido CSV con los prestadores a importar"
        testID="importar-csv"
      />

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
          <View style={estilos.resultadoLineaFila}>
            <MaterialIcons name="check-circle" size={16} color={COLORS.brandVerde} />
            <Text style={estilos.resultadoLinea}>
              Insertados: {ultimoResultado.insertados}
            </Text>
          </View>
          <View style={estilos.resultadoLineaFila}>
            <MaterialIcons name="error-outline" size={16} color={COLORS.error} />
            <Text style={estilos.resultadoLinea}>
              Errores: {ultimoResultado.errores.length}
            </Text>
          </View>
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
  resultadoLineaFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginVertical: 2,
  },
  resultadoLinea: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface },
  listaErrores: { marginTop: SPACING.xs, gap: 2 },
  errorLinea: { ...TYPOGRAPHY.bodySm, color: COLORS.error, fontFamily: 'monospace' },
});