/**
 * Hook wrapper para información de conectividad de red.
 *
 * Usa @react-native-community/netinfo para suscribirse a cambios de red
 * en tiempo real. Retorna { isConnected: boolean | null }:
 *   - null  → estado inicial, aún no determinado
 *   - true  → con conexión
 *   - false → sin conexión
 *
 * El contrato del hook no cambia respecto al shim anterior — las pantallas
 * que lo consumen no necesitan modificaciones.
 */
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useNetInfo(): { isConnected: boolean | null } {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    // Consulta el estado actual al montar — sin esto isConnected queda en
    // null hasta que cambie la red por primera vez
    NetInfo.fetch().then((state) => {
      setIsConnected(state.isConnected);
    }).catch(() => {
      setIsConnected(false);
    });

    // Suscripción reactiva — actualiza cuando cambia la red
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected);
    });
    return unsubscribe;
  }, []);

  return { isConnected };
}
