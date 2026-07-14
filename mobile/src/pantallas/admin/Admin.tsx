/**
 * Pantalla admin: menú de administración EPC.
 *
 * Acceso a las 4 pantallas de gestión multi-tenant:
 * - Gestión de prestadores (lista + CRUD)
 * - Acuerdo Municipal (topes por prestador)
 * - Parámetros tarifarios (costos medios por prestador)
 * - Importar prestadores (CSV bulk)
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../theme/skeletal-tokens';
import type { ConfigStackParamList } from '../../navegacion/types';
import { WorkspaceSwitcher } from '../../composicion/WorkspaceSwitcher';
import { useWorkspace } from '../../composicion/useWorkspace';

type Props = NativeStackScreenProps<ConfigStackParamList, 'Admin'>;

interface OpcionMenu {
  readonly key: keyof ConfigStackParamList;
  readonly icono: string;
  readonly titulo: string;
  readonly descripcion: string;
  readonly colorFondo: string;
}

const OPCIONES: readonly OpcionMenu[] = [
  {
    key: 'GestionPrestadores',
    icono: 'business',
    titulo: 'Gestión de Prestadores',
    descripcion: 'Lista, busca, crea, edita y suspende los 300 prestadores vinculados',
    colorFondo: COLORS.primary,
  },
  {
    key: 'AcuerdoMunicipal',
    icono: 'gavel',
    titulo: 'Acuerdo Municipal',
    descripcion: 'Topes de subsidio y contribución aprobados por el Concejo',
    colorFondo: COLORS.tertiary,
  },
  {
    key: 'ParametrosTarifa',
    icono: 'calculate',
    titulo: 'Parámetros Tarifarios',
    descripcion: 'Costo fijo, bloques, costos medios y mínimo vital por prestador',
    colorFondo: COLORS.secondary,
  },
  {
    key: 'ImportarPrestadores',
    icono: 'upload-file',
    titulo: 'Importar desde CSV',
    descripcion: 'Carga masiva de los 300 prestadores desde un spreadsheet',
    colorFondo: COLORS.tertiaryContainer,
  },
];

export default function Admin({ navigation }: Props) {
  const { setIdPrestadorActivo, cargarContexto } = useWorkspace();

  const onCambiarPrestador = async (id: number): Promise<void> => {
    await setIdPrestadorActivo(id);
    // El caller (en Configuracion u otro) puede invocar cargarContexto si lo necesita
  };

  return (
    <ScrollView style={estilos.root} contentContainerStyle={estilos.content}>
      <View style={estilos.header}>
        <View style={{ flex: 1 }}>
          <Text style={estilos.titulo}>Administración EPC</Text>
          <Text style={estilos.sub}>
            Programa "Agua la Vereda" · gestión de prestadores rurales
          </Text>
        </View>
        <WorkspaceSwitcher onCambiar={onCambiarPrestador} />
      </View>

      {OPCIONES.map((op) => (
        <Pressable
          key={op.key}
          style={[estilos.opcion, { backgroundColor: op.colorFondo }]}
          onPress={() => navigation.navigate(op.key)}
        >
          <MaterialIcons name={op.icone} size={32} color={COLORS.onPrimary} />
          <View style={estilos.opcionTexto}>
            <Text style={estilos.opcionTitulo}>{op.titulo}</Text>
            <Text style={estilos.opcionDesc}>{op.descripcion}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={28} color={COLORS.onPrimary} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, gap: SPACING.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  titulo: { ...TYPOGRAPHY.titleLg, color: COLORS.onSurface },
  sub: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.md,
  },
  opcionTexto: { flex: 1, gap: 2 },
  opcionTitulo: { ...TYPOGRAPHY.titleSm, color: COLORS.onPrimary },
  opcionDesc: { ...TYPOGRAPHY.bodySm, color: COLORS.onPrimary, opacity: 0.85 },
});
