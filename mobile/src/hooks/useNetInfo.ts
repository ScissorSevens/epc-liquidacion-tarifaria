/**
 * Hook wrapper para información de conectividad de red.
 *
 * SHIM INTENCIONAL: `@react-native-community/netinfo` NO está instalado en
 * este proyecto. Este hook retorna siempre `{ isConnected: false }`, lo que
 * hace que el banner "Sin conexión" en RutaDeHoy sea siempre visible.
 *
 * Esto es correcto para el comportamiento offline-first de MediApp: los datos
 * siempre se guardan localmente y se sincronizan manualmente desde el tab
 * SINCRONIZACIÓN.
 *
 * Para conectar el estado de red real en el futuro:
 *   1. `npm install @react-native-community/netinfo`
 *   2. Reemplazar el cuerpo de este hook por:
 *      ```ts
 *      import NetInfo from '@react-native-community/netinfo';
 *      export function useNetInfo() {
 *        const [state, setState] = useState<{ isConnected: boolean | null }>({ isConnected: null });
 *        useEffect(() => NetInfo.addEventListener(s => setState({ isConnected: s.isConnected })), []);
 *        return state;
 *      }
 *      ```
 *   3. Sin tocar ninguna pantalla — el contrato del hook no cambia.
 */
export function useNetInfo(): { isConnected: boolean | null } {
  return { isConnected: false };
}
