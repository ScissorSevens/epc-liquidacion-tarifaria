/**
 * Pantalla admin: gestión de prestadores rurales vinculados a EPC.
 *
 * Lista los 300 prestadores del programa "Agua la Vereda" con paginación
 * y búsqueda. Permite crear, editar y suspender prestadores.
 */
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../theme/skeletal-tokens';
import { BotonPrimario } from '../../componentes/BotonPrimario';
import { useWorkspace } from '../../composicion/useWorkspace';
import { getBootstrap } from '../../composition/get-bootstrap';
import type { ConfigStackParamList } from '../../navegacion/types';
import type { Prestador } from '../../../dominio/prestadores/types';

interface GestionPrestadoresRepo {
  readonly listar: () => Promise<readonly Prestador[]>;
  readonly suspender: (id: number) => Promise<void>;
}

interface Props {
  /** Si no se provee, se resuelve via `getBootstrap()` (patrón del resto del código). */
  readonly repo?: GestionPrestadoresRepo;
  /** Si no se provee, navega internamente via `useNavigation()`. */
  readonly onAbrirAcuerdo?: (id: number) => void;
  /** Si no se provee, navega internamente via `useNavigation()`. */
  readonly onAbrirParametros?: (id: number) => void;
}

export default function GestionPrestadores({
  repo: repoProp,
  onAbrirAcuerdo,
  onAbrirParametros,
}: Props) {
  // PER-05: selector específico. Suscripción limitada a id_prestador_activo
  // (único campo del store que este componente lee — para resaltar el
  // card del prestador activo). Cambios en acuerdo_vigente,
  // parametros_vigentes, prestadores_disponibles, cargando o prestador
  // NO causan re-render.
  const id_prestador_activo = useWorkspace((s) => s.id_prestador_activo);
  const navigation = useNavigation<NativeStackNavigationProp<ConfigStackParamList>>();
  const [repo, setRepo] = useState<GestionPrestadoresRepo | null>(repoProp ?? null);
  const [prestadores, setPrestadores] = useState<readonly Prestador[]>([]);
  const [filtro, setFiltro] = useState('');
  const [cargando, setCargando] = useState(true);

  // Resolver repo internamente si no vino inyectado desde el Stack.
  useEffect(() => {
    if (repo !== null) return;
    let cancelado = false;
    void (async () => {
      const bs = await getBootstrap();
      if (!cancelado) {
        setRepo({
          listar: () => bs.repos.prestadorRepo.listar(),
          suspender: async (id: number) => {
            await bs.repos.prestadorRepo.suspender(id);
          },
        });
      }
    })();
    return () => { cancelado = true; };
  }, [repo]);

  useEffect(() => {
    if (repo === null) return;
    let cancelado = false;
    void (async () => {
      setCargando(true);
      try {
        const lista = await repo.listar();
        if (!cancelado) {
          setPrestadores(lista);
          setCargando(false);
        }
      } catch {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [repo]);

  const abrirAcuerdo = (id: number): void => {
    if (onAbrirAcuerdo) {
      onAbrirAcuerdo(id);
      return;
    }
    navigation.navigate('AcuerdoMunicipal', { id_prestador: id });
  };

  const abrirParametros = (id: number): void => {
    if (onAbrirParametros) {
      onAbrirParametros(id);
      return;
    }
    navigation.navigate('ParametrosTarifa', { id_prestador: id });
  };

  const filtrados = prestadores.filter((p) => {
    const q = filtro.toLowerCase();
    return (
      p.nombre.toLowerCase().includes(q) ||
      p.codigo.toLowerCase().includes(q) ||
      p.municipio.toLowerCase().includes(q) ||
      p.nit.toLowerCase().includes(q)
    );
  });

  return (
    <View style={estilos.root}>
      <View style={estilos.buscador}>
        <MaterialIcons name="search" size={20} color={COLORS.outline} />
        <TextInput
          style={estilos.input}
          placeholder="Buscar por nombre, código, municipio o NIT"
          placeholderTextColor={COLORS.outlineVariant}
          value={filtro}
          onChangeText={setFiltro}
        />
      </View>
      {cargando ? (
        <Text style={estilos.estado}>Cargando prestadores...</Text>
      ) : filtrados.length === 0 ? (
        <Text style={estilos.estado}>No hay prestadores que coincidan con "{filtro}".</Text>
      ) : (
        <FlatList
          data={filtrados as Prestador[]}
          keyExtractor={(p) => String(p.id_prestador)}
          contentContainerStyle={estilos.lista}
          renderItem={({ item }) => (
            <View
              style={[
                estilos.card,
                item.id_prestador === id_prestador_activo && estilos.cardActivo,
              ]}
            >
              <View style={estilos.cardHeader}>
                <Text style={estilos.cardTitulo}>{item.nombre}</Text>
                <Text style={estilos.cardSub}>
                  {item.codigo} · NIT {item.nit}
                </Text>
                <Text style={estilos.cardSub}>
                  {item.municipio}, {item.departamento} · Seg. {item.segmento}
                </Text>
                <Text style={estilos.cardSub}>
                  {item.num_suscriptores_urbanos} urbanos · {item.num_suscriptores_rurales} rurales
                </Text>
              </View>
              <View style={estilos.acciones}>
                <BotonPrimario
                  texto="Acuerdo"
                  icono="gavel"
                  tono="azul"
                  tamano="compacto"
                  onPress={() => abrirAcuerdo(item.id_prestador)}
                />
                <BotonPrimario
                  texto="Parámetros"
                  icono="calculate"
                  tono="azul"
                  tamano="compacto"
                  onPress={() => abrirParametros(item.id_prestador)}
                />
                {item.estado === 'activo' && (
                  <BotonPrimario
                    texto="Suspender"
                    icono="block"
                    tono="rojo"
                    tamano="compacto"
                    onPress={() => {
                      if (repo === null) return;
                      void repo.suspender(item.id_prestador).then(() =>
                        setPrestadores((prev) =>
                          prev.map((p) =>
                            p.id_prestador === item.id_prestador ? { ...p, estado: 'suspendido' } : p,
                          ),
                        ),
                      );
                    }}
                  />
                )}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: SPACING.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  input: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.onSurface,
    flex: 1,
    paddingVertical: SPACING.sm,
    marginLeft: SPACING.xs,
  },
  estado: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
  lista: { padding: SPACING.md, gap: SPACING.sm },
  card: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  cardActivo: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  cardHeader: { gap: 2 },
  cardTitulo: { ...TYPOGRAPHY.headlineMd, color: COLORS.onSurface },
  cardSub: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant },
  acciones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  // Los 3 botones (Acuerdo / Parámetros / Suspender) se renderizan
  // via <BotonPrimario tamano="compacto"> extraído.
});
