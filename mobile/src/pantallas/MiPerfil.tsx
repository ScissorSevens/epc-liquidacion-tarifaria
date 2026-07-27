/**
 * Pantalla Mi Perfil — datos reales del operario + prestador + parámetros
 * tarifarios.
 *
 * TAREA 11 — Reemplazo del PERFIL hardcoded (commit 1) + sección de
 * parámetros tarifarios del prestador activo (commit 2) + edición vía
 * modal con FormField (commit 3).
 *
 * Fuentes de datos:
 *   - Sesion (AsyncStorage via `cargarSesion()`): cedula, nombre,
 *     idOperario. La sesión NO trae email ni teléfono — esos campos se
 *     muestran como "—" hasta que se agregue un flujo de edición de
 *     perfil del operario. (Operario.email existe en dominio pero requiere
 *     fetch via operarioRepo, fuera de scope.)
 *   - useWorkspace.prestador: nombre, municipio, codigo del prestador
 *     activo. Se popula vía WorkspaceSwitcher / cambiarPrestadorYCargarContexto.
 *   - useWorkspace.parametros_vigentes: CMA, CMO, CMI, CMT, CMVIAA,
 *     mínimo vital, fechas de vigencia. Lo carga el bootstrap inicial.
 */
import { useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { BotonPrimario } from '../componentes/BotonPrimario';
import { FooterApp } from '../componentes/FooterApp';
import { FormField } from '../componentes/FormField';
import { TarjetaMetrica } from '../componentes/TarjetaMetrica';
import { TopBar } from '../componentes/TopBar';
import { limpiarSesion, cargarSesion, type Sesion } from '../composition/constantes';
import { useWorkspace } from '../composicion/useWorkspace';
import {
  COLORS,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  BORDERS,
} from '../theme/skeletal-tokens';
import type { ConfigStackScreenProps } from '../navegacion/types';
import type { ParametrosTarifa } from '../../dominio/parametros-tarifa/types';

type Props = ConfigStackScreenProps<'MiPerfil'> & {
  readonly onLogoutRequested: () => void;
};

/** Placeholder honesto cuando no hay dato real cargado todavía. */
const PLACEHOLDER = '—';

/** Iniciales (hasta 2 letras) derivadas del nombre. Vacío si no hay nombre. */
function obtenerIniciales(nombre: string | undefined): string {
  if (nombre === undefined || nombre.trim() === '') return '';
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Formatea un número con separador de miles estilo CO (punto).
 *
 * Locale-agnóstico (no usa `Intl.NumberFormat` porque su disponibilidad
 * con locale `es-CO` varía entre Hermes y Node — preferimos un split por
 * regex que produce el mismo string en ambos runtimes).
 */
function formatearNumero(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Estado del formulario del modal de edición de parámetros tarifarios.
 *
 * Todos los campos son strings (estado controlado de FormField) — la
 * coerción a número ocurre al guardar. Mantener todo como string evita
 * que un campo vacío ("") se convierta en `0` silenciosamente y arruine
 * la edición (el operario no podría distinguir "no editado" de "editado
 * a 0").
 */
interface FormParametros {
  readonly periodo: string;
  readonly cma: string;
  readonly cmo: string;
  readonly cmi: string;
  readonly cmt: string;
  readonly cmviaa: string;
  readonly agua: string;
  readonly ipuf: string;
  readonly suscriptores: string;
  readonly m3gratis: string;
  readonly vigenteDesde: string;
  readonly vigenteHasta: string;
}

function formParametrosDesde(p: ParametrosTarifa): FormParametros {
  return {
    periodo: String(p.periodo),
    cma: String(p.cma),
    cmo: String(p.cmo),
    cmi: String(p.cmi),
    cmt: String(p.cmt),
    cmviaa: String(p.cmviaa),
    agua: String(p.agua_suministrada_m3_anio),
    ipuf: String(p.ipuf_m3_suscriptor_mes),
    suscriptores: String(p.suscriptores_promedio),
    m3gratis: String(p.m3_gratis_minimo_vital),
    // Slice para quedarnos con YYYY-MM-DD aunque el stored value sea
    // un ISO completo (algunos seeds usan ISO 8601 con hora).
    vigenteDesde: p.vigente_desde.slice(0, 10),
    vigenteHasta: p.vigente_hasta.slice(0, 10),
  };
}

/**
 * Defaults normativos para crear un ParametrosTarifa "desde cero"
 * cuando el store no tiene parámetros vigentes aún (caso típico:
 * prestador activo pero parámetros nunca asignados).
 *
 * Decisiones (Res CRA 825/2017 + 907/2019):
 *   - Costos medios (CMA/CMO/CMI/CMT/CMVIAA) en 0. El operario los
 *     tipea a mano (no podemos adivinarlos del store sin una fuente).
 *   - IPUF en 6 m³/suscriptor/mes: constante normativa del art. 5
 *     Res CRA 825/2017. Default seguro.
 *   - Mínimo vital en 6 m³: default del sistema (la spec Q9 dice que
 *     825/2017 no obliga, pero 6 m³ es el valor que la mayoría de
 *     prestadores rurales EPC adoptan).
 *   - Flags (aplica_cmviaa, aplica_minimo_vital) en false: defaults
 *     seguros. El operario los activa a mano si los necesita.
 *   - Vigente desde = hoy; hasta = hoy + 5 años (periodo tarifario
 *     Res 825/2017).
 *   - Periodo = año actual.
 *   - suscriptores_promedio = 1 (mínimo >0 que el dominio acepta
 *     en MENSAJES_ERROR_PARAMETROS.SUSCRIPTORES_REQUERIDO). Si el
 *     operario no edita este campo, el motor tarifario va a dar
 *     resultados absurdos con divisor=1 — pero eso es preferible
 *     a fallar la creación.
 *   - agua_suministrada_m3_anio = 0: no podemos inferir.
 *   - id_parametros = 0 (lo asignará SQLite al persistir).
 *   - id_acuerdo = 0 (no hay acuerdo vigente editable desde MiPerfil;
 *     este campo se corrige cuando se persiste via el repo).
 *   - created_at = ahora (placeholder; el repo lo sobreescribe al
 *     persistir).
 *
 * El id_prestador se pasa por parámetro para que el nuevo objeto
 * quede atado al prestador activo del store (no a un literal 0).
 */
function parametrosDefaults(id_prestador: number): ParametrosTarifa {
  const hoy = new Date();
  const hasta = new Date(hoy);
  hasta.setFullYear(hasta.getFullYear() + 5);
  return {
    id_parametros: 0,
    id_prestador,
    id_acuerdo: 0,
    periodo: hoy.getFullYear(),
    cma: 0,
    cmo: 0,
    cmi: 0,
    cmt: 0,
    cmviaa: 0,
    aplica_cmviaa: false,
    agua_suministrada_m3_anio: 0,
    ipuf_m3_suscriptor_mes: 6,
    suscriptores_promedio: 1,
    aplica_minimo_vital: false,
    m3_gratis_minimo_vital: 6,
    vigente_desde: hoy.toISOString().slice(0, 10),
    vigente_hasta: hasta.toISOString().slice(0, 10),
    created_at: hoy.toISOString(),
  };
}

/** Coerciona un string a número. Vacío o inválido → 0. */
function aNumero(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Coerciona un string a entero. Vacío o inválido → 0. */
function aEntero(s: string): number {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

export default function MiPerfil({ navigation, onLogoutRequested }: Props) {
  const [toastVisible, setToastVisible] = useState(false);
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<FormParametros | null>(null);

  // PER-05: selectores específicos. Solo nos interesa prestador,
  // parametros_vigentes y el setter. Cambios en prestadores_disponibles
  // / cargando / acuerdo_vigente NO causan re-render.
  const prestador = useWorkspace((s) => s.prestador);
  const idPrestadorActivo = useWorkspace((s) => s.id_prestador_activo);
  const parametros = useWorkspace((s) => s.parametros_vigentes);
  const setParametrosVigentes = useWorkspace((s) => s.setParametrosVigentes);

  // Cargar sesión al mount. La sesión vive en AsyncStorage bajo
  // `@sistema_epc:sesion` y `cargarSesion()` ya valida vigencia + shape.
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const s = await cargarSesion();
      if (!cancelado) setSesion(s);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  function mostrarToast() {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }

  // ── Handlers del modal ────────────────────────────────────────────────────
  function abrirModalEdicion(): void {
    // Si hay parámetros vigentes, prellenamos con esos. Si NO hay (caso
    // "crear desde cero"), prellenamos con defaults normativos — ver
    // `parametrosDefaults` arriba. El operario puede editar lo que
    // difiera del default sin tener que tipear 12 campos vacíos.
    const base: ParametrosTarifa =
      parametros ?? parametrosDefaults(idPrestadorActivo);
    setForm(formParametrosDesde(base));
    setModalVisible(true);
  }

  function cerrarModalEdicion(): void {
    setModalVisible(false);
    setForm(null);
  }

  function guardarEdicion(): void {
    if (form === null) return;
    // Si hay parámetros previos, MERGEAMOS (preservamos id_parametros,
    // id_prestador, id_acuerdo, created_at del store). Si NO hay,
    // partimos de los defaults para esos campos administrativos — el
    // operario solo edita los valores del form.
    const base: ParametrosTarifa =
      parametros ?? parametrosDefaults(idPrestadorActivo);
    const nuevosParametros: ParametrosTarifa = {
      ...base,
      periodo: aEntero(form.periodo),
      cma: aNumero(form.cma),
      cmo: aNumero(form.cmo),
      cmi: aNumero(form.cmi),
      cmt: aNumero(form.cmt),
      cmviaa: aNumero(form.cmviaa),
      agua_suministrada_m3_anio: aNumero(form.agua),
      ipuf_m3_suscriptor_mes: aNumero(form.ipuf),
      suscriptores_promedio: aEntero(form.suscriptores),
      m3_gratis_minimo_vital: aEntero(form.m3gratis),
      vigente_desde: form.vigenteDesde,
      vigente_hasta: form.vigenteHasta,
    };
    setParametrosVigentes(nuevosParametros);
    setModalVisible(false);
    setForm(null);
  }

  // Helper para escribir un campo del form sin perder el resto.
  function setCampo<K extends keyof FormParametros>(
    key: K,
    valor: FormParametros[K],
  ): void {
    if (form === null) return;
    setForm({ ...form, [key]: valor });
  }

  // ── Valores derivados ─────────────────────────────────────────────────────
  const nombre = sesion?.nombre ?? PLACEHOLDER;
  const idOperarioNum = sesion?.idOperario;
  const cedula = sesion?.cedula ?? PLACEHOLDER;
  const idOperarioStr =
    idOperarioNum !== undefined && idOperarioNum > 0
      ? `#${idOperarioNum}`
      : PLACEHOLDER;
  const inicialesCalc = obtenerIniciales(sesion?.nombre);
  // Sin sesion caemos al placeholder legacy "OP" (Operario) — backward
  // compatible con tests MP-2 que verifican que el avatar muestra "OP"
  // en el estado "sin sesión".
  const iniciales = inicialesCalc === '' ? 'OP' : inicialesCalc;
  // Rol: la Sesion no trae rol explícito; mostramos "Operario" cuando
  // hay sesion activa. "—" en el fallback para no mentir con un literal
  // hardcoded (el viejo "Operario rural · EPC" era engañoso).
  const rol = sesion !== null ? 'Operario' : PLACEHOLDER;
  const prestadorNombre = prestador?.nombre ?? PLACEHOLDER;
  const prestadorMunicipio = prestador?.municipio ?? '';
  const prestadorCodigo = prestador?.codigo ?? '';

  return (
    <View style={estilos.raiz}>
      {/* Top App Bar */}
      <TopBar
        titulo="Mi Perfil"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={estilos.scroll}>
        {/* Avatar */}
        <View style={estilos.avatarSeccion}>
          <View style={estilos.avatar} testID="avatar">
            <Text style={estilos.avatarTexto}>{iniciales}</Text>
          </View>
          <Text style={estilos.nombre} testID="perfil-nombre">{nombre}</Text>
          <Text style={estilos.rol} testID="perfil-rol">{rol}</Text>
        </View>

        {/* Actividad Reciente */}
        <Text style={estilos.seccionTitulo}>Actividad reciente</Text>
        <View style={estilos.gridFila}>
          <TarjetaMetrica
            icono="edit-note"
            etiqueta="Lecturas"
            valor={PLACEHOLDER}
            variante="normal"
            testID="tarjeta-lecturas"
          />
          <TarjetaMetrica
            icono="sync"
            etiqueta="Última sincronización"
            valor={PLACEHOLDER}
            variante="normal"
            testID="tarjeta-ultima-sincro"
          />
        </View>

        {/* Información Personal */}
        <Text style={estilos.seccionTitulo}>Información personal</Text>
        <View style={estilos.listaCard}>
          <FilaInfo
            etiqueta="Cédula"
            valor={cedula}
            testID="fila-cedula"
            borde
          />
          <FilaInfo
            etiqueta="ID Operario"
            valor={idOperarioStr}
            testID="fila-id-operario"
            borde
          />
          <FilaInfo
            etiqueta="Teléfono"
            valor={PLACEHOLDER}
            testID="fila-telefono"
            borde
          />
          <FilaInfo
            etiqueta="Correo"
            valor={PLACEHOLDER}
            testID="fila-correo"
          />
        </View>

        {/* Prestador activo */}
        <Text style={estilos.seccionTitulo}>Prestador activo</Text>
        <View style={estilos.listaCard}>
          <FilaInfo
            etiqueta="Nombre"
            valor={prestadorNombre}
            testID="fila-prestador-nombre"
            borde
          />
          <FilaInfo
            etiqueta="Municipio"
            valor={prestadorMunicipio === '' ? PLACEHOLDER : prestadorMunicipio}
            testID="fila-prestador-municipio"
            borde
          />
          <FilaInfo
            etiqueta="Código"
            valor={prestadorCodigo === '' ? PLACEHOLDER : prestadorCodigo}
            testID="fila-prestador-codigo"
          />
        </View>

        {/* Parámetros tarifarios — Res CRA 825/2017 + 907/2019 */}
        <View style={estilos.seccionHeader}>
          <Text style={estilos.seccionTitulo}>Parámetros tarifarios</Text>
          {/* El botón Editar se muestra SIEMPRE — incluso si no hay
              parámetros vigentes aún. Caso típico: el prestador activo
              no tiene parámetros asignados (fresh install sin setup
              completo). Antes este botón estaba gated por
              `parametros !== null`, lo que dejaba al operario con una
              sección llena de "—" sin forma de configurar nada (el
              user reportó "no veo cómo configurar los parámetros
              tarifarios"). Al presionar Editar sin parámetros previos,
              el modal prellena defaults normativos (ver
              `parametrosDefaults`). */}
          <Pressable
            style={estilos.botonEditar}
            onPress={abrirModalEdicion}
            testID="boton-editar-parametros"
            accessibilityRole="button"
            accessibilityLabel={
              parametros !== null
                ? 'Editar parámetros tarifarios'
                : 'Configurar parámetros tarifarios'
            }
          >
            <MaterialIcons name="edit" size={16} color={COLORS.primary} />
            <Text style={estilos.botonEditarTexto}>
              {parametros !== null ? 'Editar' : 'Configurar'}
            </Text>
          </Pressable>
        </View>
        <View style={estilos.listaCard}>
          <FilaInfo
            etiqueta="CMA · Costo Medio de Administración ($/año)"
            valor={parametros !== null ? formatearNumero(parametros.cma) : PLACEHOLDER}
            testID="fila-param-cma"
            borde
          />
          <FilaInfo
            etiqueta="CMO · Costo Medio de Operación ($/m³)"
            valor={parametros !== null ? formatearNumero(parametros.cmo) : PLACEHOLDER}
            testID="fila-param-cmo"
            borde
          />
          <FilaInfo
            etiqueta="CMI · Costo Medio de Inversión ($/m³)"
            valor={parametros !== null ? formatearNumero(parametros.cmi) : PLACEHOLDER}
            testID="fila-param-cmi"
            borde
          />
          <FilaInfo
            etiqueta="CMT · Costo Medio de Tasas Ambientales ($/m³)"
            valor={parametros !== null ? formatearNumero(parametros.cmt) : PLACEHOLDER}
            testID="fila-param-cmt"
            borde
          />
          <FilaInfo
            etiqueta="CMVIAA · Inversiones Ambientales Adic. ($/m³)"
            valor={
              parametros !== null && parametros.aplica_cmviaa
                ? formatearNumero(parametros.cmviaa)
                : PLACEHOLDER
            }
            testID="fila-param-cmviaa"
            borde
          />
          <FilaInfo
            etiqueta="Mínimo vital (m³)"
            valor={
              parametros !== null && parametros.aplica_minimo_vital
                ? `${formatearNumero(parametros.m3_gratis_minimo_vital)} m³`
                : PLACEHOLDER
            }
            testID="fila-param-minimo-vital"
            borde
          />
          <FilaInfo
            etiqueta="Vigente desde"
            valor={parametros !== null ? parametros.vigente_desde.slice(0, 10) : PLACEHOLDER}
            testID="fila-param-vigente-desde"
            borde
          />
          <FilaInfo
            etiqueta="Vigente hasta"
            valor={parametros !== null ? parametros.vigente_hasta.slice(0, 10) : PLACEHOLDER}
            testID="fila-param-vigente-hasta"
          />
        </View>

        {/* Configuración */}
        <Text style={estilos.seccionTitulo}>Configuración</Text>
        <View style={estilos.listaCard}>
          <View style={estilos.filaConfig}>
            <Pressable style={estilos.filaConfigIzq} onPress={mostrarToast} accessibilityLabel="Notificaciones — próximamente">
              <MaterialIcons name="notifications" size={20} color={COLORS.primary} />
              <Text style={estilos.filaConfigTexto}>Notificaciones</Text>
            </Pressable>
            {/* Toggle visual estático — funcionalidad futura */}
            <Pressable onPress={mostrarToast} accessibilityLabel="Activar notificaciones">
              <View style={estilos.toggleOff}>
                <View style={estilos.toggleThumb} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* Cerrar sesión */}
        <BotonPrimario
          texto="Cerrar sesión"
          tono="rojo"
          icono="logout"
          onPress={async () => {
            await limpiarSesion();
            onLogoutRequested();
          }}
          testID="boton-cerrar-sesion"
        />

        <FooterApp />
      </ScrollView>

      {/* Modal de edición de parámetros tarifarios */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={cerrarModalEdicion}
      >
        <Pressable
          style={estilos.modalOverlay}
          onPress={cerrarModalEdicion}
          testID="modal-overlay"
        >
          {/* El Pressable interior absorbe el tap para que NO se cierre
              el modal cuando el operario toca dentro del card. */}
          <Pressable style={estilos.modalCard} onPress={() => {}}>
            <View style={estilos.modalHeader}>
              <Text style={estilos.modalTitulo}>Editar parámetros tarifarios</Text>
              <Pressable
                onPress={cerrarModalEdicion}
                hitSlop={12}
                testID="modal-cerrar"
                accessibilityRole="button"
                accessibilityLabel="Cerrar modal de edición"
              >
                <MaterialIcons name="close" size={22} color={COLORS.primary} />
              </Pressable>
            </View>

            <ScrollView
              style={estilos.modalScroll}
              keyboardShouldPersistTaps="handled"
            >
              {form !== null && (
                <>
                  <FormField
                    label="Periodo (año tarifario, 5 años)"
                    value={form.periodo}
                    onChangeText={(v) => setCampo('periodo', v)}
                    keyboardType="numeric"
                    testID="param-periodo"
                  />
                  <FormField
                    label="Vigente desde (YYYY-MM-DD)"
                    value={form.vigenteDesde}
                    onChangeText={(v) => setCampo('vigenteDesde', v)}
                    testID="param-vigente-desde"
                  />
                  <FormField
                    label="Vigente hasta (YYYY-MM-DD)"
                    value={form.vigenteHasta}
                    onChangeText={(v) => setCampo('vigenteHasta', v)}
                    testID="param-vigente-hasta"
                  />

                  <Text style={estilos.modalSeccion}>Costos medios</Text>
                  <FormField
                    label="CMA · Costo Medio Administración ($/año)"
                    value={form.cma}
                    onChangeText={(v) => setCampo('cma', v)}
                    keyboardType="numeric"
                    testID="param-cma"
                  />
                  <FormField
                    label="CMO · Costo Medio Operación ($/m³)"
                    value={form.cmo}
                    onChangeText={(v) => setCampo('cmo', v)}
                    keyboardType="numeric"
                    testID="param-cmo"
                  />
                  <FormField
                    label="CMI · Costo Medio Inversión ($/m³)"
                    value={form.cmi}
                    onChangeText={(v) => setCampo('cmi', v)}
                    keyboardType="numeric"
                    testID="param-cmi"
                  />
                  <FormField
                    label="CMT · Costo Medio Tasas Ambientales ($/m³)"
                    value={form.cmt}
                    onChangeText={(v) => setCampo('cmt', v)}
                    keyboardType="numeric"
                    testID="param-cmt"
                  />
                  <FormField
                    label="CMVIAA · Inv. Ambientales Adic. ($/m³)"
                    value={form.cmviaa}
                    onChangeText={(v) => setCampo('cmviaa', v)}
                    keyboardType="numeric"
                    testID="param-cmviaa"
                  />

                  <Text style={estilos.modalSeccion}>Agua y suscriptores</Text>
                  <FormField
                    label="Agua Suministrada (m³/año)"
                    value={form.agua}
                    onChangeText={(v) => setCampo('agua', v)}
                    keyboardType="numeric"
                    testID="param-agua"
                  />
                  <FormField
                    label="IPUF (m³/suscriptor/mes)"
                    value={form.ipuf}
                    onChangeText={(v) => setCampo('ipuf', v)}
                    keyboardType="numeric"
                    testID="param-ipuf"
                  />
                  <FormField
                    label="Suscriptores promedio (N)"
                    value={form.suscriptores}
                    onChangeText={(v) => setCampo('suscriptores', v)}
                    keyboardType="numeric"
                    testID="param-suscriptores"
                  />

                  <Text style={estilos.modalSeccion}>Mínimo vital</Text>
                  <FormField
                    label="Mínimo vital (m³ gratis)"
                    value={form.m3gratis}
                    onChangeText={(v) => setCampo('m3gratis', v)}
                    keyboardType="numeric"
                    testID="param-m3gratis"
                  />
                </>
              )}
            </ScrollView>

            <View style={estilos.modalFooter}>
              <Pressable
                style={estilos.modalBtnSecundario}
                onPress={cerrarModalEdicion}
                testID="param-cancelar"
                accessibilityRole="button"
                accessibilityLabel="Cancelar edición de parámetros"
              >
                <Text style={estilos.modalBtnSecundarioTexto}>Cancelar</Text>
              </Pressable>
              <View style={estilos.modalBtnPrimario}>
                <BotonPrimario
                  texto="Guardar"
                  tono="azul"
                  icono="save"
                  onPress={guardarEdicion}
                  testID="param-guardar"
                />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {toastVisible && (
        <View style={estilos.toast}>
          <Text style={estilos.toastTexto}>Próximamente disponible</Text>
        </View>
      )}
    </View>
  );
}

function FilaInfo({
  etiqueta,
  valor,
  borde,
  testID,
}: {
  etiqueta: string;
  valor: string;
  borde?: boolean;
  testID?: string;
}) {
  return (
    <View style={[estilos.fila, borde && estilos.filaBorde]} testID={testID}>
      <Text style={estilos.filaEtiqueta}>{etiqueta}</Text>
      <Text
        style={estilos.filaValor}
        testID={testID !== undefined ? `${testID}-valor` : undefined}
      >
        {valor}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    paddingBottom: SPACING.xxl,
  },
  avatarSeccion: {
    alignItems: 'center',
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.margin,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.brandAzulOscuro,
    borderWidth: 1,
    borderColor: COLORS.brandAzulOscuro,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  avatarTexto: {
    ...TYPOGRAPHY.headlineLg,
    color: COLORS.onPrimary,
  },
  nombre: {
    ...TYPOGRAPHY.headlineMd,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  rol: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onSurfaceVariant,
  },
  seccionTitulo: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.onSurfaceVariant,
    marginHorizontal: SPACING.margin,
    marginBottom: SPACING.sm,
    marginTop: SPACING.lg,
  },
  gridFila: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginHorizontal: SPACING.margin,
  },
  listaCard: {
    marginHorizontal: SPACING.margin,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.xl,
    ...BORDERS.thin,
    overflow: 'hidden',
  },
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  filaBorde: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
  },
  filaEtiqueta: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onSurfaceVariant,
  },
  filaValor: {
    ...TYPOGRAPHY.bodyMd,
    fontWeight: '700',
    color: COLORS.primary,
  },
  filaConfig: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  filaConfigIzq: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 4,
  },
  filaConfigTexto: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.primary,
  },
  toggleOff: {
    width: 44,
    height: 24,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceDim,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  toggleThumb: {
    width: 16,
    height: 16,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  toast: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 4,
    borderRadius: RADIUS.full,
  },
  toastTexto: {
    color: COLORS.onPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  // ── Header de sección con acción inline (e.g. "Editar" en Parámetros) ──
  seccionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: SPACING.margin,
    marginBottom: SPACING.sm,
    marginTop: SPACING.lg,
  },
  botonEditar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    // WCAG 2.5.5: touch target >= 44px.
    minHeight: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  botonEditarTexto: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
    fontWeight: '600',
  },
  // ── Modal de edición ────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.margin,
  },
  modalCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.lg,
    width: '100%',
    maxHeight: '85%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
  },
  modalTitulo: {
    ...TYPOGRAPHY.headlineSm,
    color: COLORS.primary,
    flexShrink: 1,
  },
  modalScroll: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  modalSeccion: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.onSurfaceVariant,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.outlineVariant,
    backgroundColor: COLORS.surfaceContainerLow,
  },
  modalBtnSecundario: {
    minHeight: 44, // WCAG 2.5.5
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    backgroundColor: 'transparent',
  },
  modalBtnSecundarioTexto: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
    fontWeight: '600',
  },
  modalBtnPrimario: {
    minWidth: 140,
  },
});