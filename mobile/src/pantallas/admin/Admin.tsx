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
import type { ComponentProps } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../theme/skeletal-tokens';
import type { ConfigStackParamList } from '../../navegacion/types';
import { WorkspaceSwitcher } from '../../composicion/WorkspaceSwitcher';
import { useWorkspace } from '../../composicion/useWorkspace';
import { getBootstrap } from '../../composition/get-bootstrap';

type Props = NativeStackScreenProps<ConfigStackParamList, 'Admin'>;
type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];
type AdminRoute =
  | 'GestionPrestadores'
  | 'AcuerdoMunicipal'
  | 'ParametrosTarifa'
  | 'ImportarPrestadores';

interface OpcionMenu {
  readonly key: AdminRoute;
  readonly icono: MaterialIconName;
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
    colorFondo: COLORS.warning,
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
    colorFondo: COLORS.warningContainer,
  },
];

export default function Admin({ navigation }: Props) {
  const { cambiarPrestadorYCargarContexto, id_prestador_activo } = useWorkspace();

  /**
   * Handler del WorkspaceSwitcher: cambia el prestador activo Y recarga
   * el contexto tarifario (prestador, acuerdo_vigente, parametros_vigentes).
   *
   * COR-08 (reporte de calidad): el handler previo solo actualizaba
   * `id_prestador_activo` y dejaba los datos tarifarios apuntando al
   * prestador ANTERIOR. Si el operario cambiaba de prestador, una
   * captura o liquidación posterior usaba los parámetros equivocados.
   * `cambiarPrestadorYCargarContexto` resuelve esto en un solo paso.
   */
  const onCambiarPrestador = async (id: number): Promise<void> => {
    const { prestadorRepo, acuerdoMunicipalRepo, parametrosTarifaRepo } =
      await getBootstrap();
    await cambiarPrestadorYCargarContexto(id, {
      prestador: prestadorRepo,
      acuerdo: acuerdoMunicipalRepo,
      parametros: parametrosTarifaRepo,
    });
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
          onPress={() => {
            // AcuerdoMunicipal y ParametrosTarifa requieren `id_prestador` en su
            // ParamList. GestionPrestadores e ImportarPrestadores no.
            if (op.key === 'AcuerdoMunicipal' || op.key === 'ParametrosTarifa') {
              navigation.navigate(op.key, { id_prestador: id_prestador_activo });
              return;
            }
            navigation.navigate(op.key);
          }}
        >
          <MaterialIcons name={op.icono} size={32} color={COLORS.onPrimary} />
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
  titulo: { ...TYPOGRAPHY.headlineLg, color: COLORS.onSurface },
  sub: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.md,
  },
  opcionTexto: { flex: 1, gap: 2 },
  opcionTitulo: { ...TYPOGRAPHY.headlineSm, color: COLORS.onPrimary },
  opcionDesc: { ...TYPOGRAPHY.bodySm, color: COLORS.onPrimary, opacity: 0.85 },
});
