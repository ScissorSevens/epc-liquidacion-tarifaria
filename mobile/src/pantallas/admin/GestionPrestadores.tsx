/**
 * Pantalla admin: gestión de prestadores rurales vinculados a EPC.
 *
 * Lista los 300 prestadores del programa "Agua la Vereda" con paginación
 * y búsqueda. Permite crear, editar y suspender prestadores.
 */
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../theme/skeletal-tokens';
import { useWorkspace } from '../../composicion/useWorkspace';
import type { Prestador } from '../../dominio/prestadores/types';

interface Props {
  readonly repo: {
    listar: () => Promise<readonly Prestador[]>;
    suspender: (id: number) => Promise<void>;
  };
  readonly onAbrirAcuerdo: (id: number) => void;
  readonly onAbrirParametros: (id: number) => void;
}

export default function GestionPrestadores({ repo, onAbrirAcuerdo, onAbrirParametros }: Props) {
  const { id_prestador_activo } = useWorkspace();
  const [prestadores, setPrestadores] = useState<readonly Prestador[]>([]);
  const [filtro, setFiltro] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
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
                <Pressable
                  style={estilos.boton}
                  onPress={() => onAbrirAcuerdo(item.id_prestador)}
                >
                  <MaterialIcons name="gavel" size={16} color={COLORS.onPrimary} />
                  <Text style={estilos.botonLabel}>Acuerdo</Text>
                </Pressable>
                <Pressable
                  style={estilos.boton}
                  onPress={() => onAbrirParametros(item.id_prestador)}
                >
                  <MaterialIcons name="calculate" size={16} color={COLORS.onPrimary} />
                  <Text style={estilos.botonLabel}>Parámetros</Text>
                </Pressable>
                {item.estado === 'activo' && (
                  <Pressable
                    style={[estilos.boton, estilos.botonPeligro]}
                    onPress={() => {
                      void repo.suspender(item.id_prestador).then(() =>
                        setPrestadores((prev) =>
                          prev.map((p) =>
                            p.id_prestador === item.id_prestador ? { ...p, estado: 'suspendido' } : p,
                          ),
                        ),
                      );
                    }}
                  >
                    <MaterialIcons name="block" size={16} color={COLORS.onError} />
                    <Text style={[estilos.botonLabel, estilos.botonLabelPeligro]}>
                      Suspender
                    </Text>
                  </Pressable>
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
  cardTitulo: { ...TYPOGRAPHY.titleMd, color: COLORS.onSurface },
  cardSub: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant },
  acciones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.sm,
    gap: SPACING.xs,
  },
  botonPeligro: { backgroundColor: COLORS.errorContainer },
  botonLabel: { ...TYPOGRAPHY.labelMd, color: COLORS.onPrimary },
  botonLabelPeligro: { color: COLORS.onError },
});
