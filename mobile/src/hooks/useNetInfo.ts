/**
 * Hook wrapper para información de conectividad de red.
 *
 * Usa @react-native-community/netinfo para detectar el estado real de red.
 * Retorna { isConnected: boolean | null }:
 *   - null  → estado inicial, aún no determinado
 *   - true  → con conexión
 *   - false → sin conexión
 *
 * fetch() consulta el estado actual al montar — sin esto isConnected queda
 * en null hasta que cambie la red por primera vez.
 * addEventListener actualiza reactivamente ante cada cambio de red.
 */
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useNetInfo(): { isConnected: boolean | null } {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    // Consulta estado actual al montar
    NetInfo.fetch().then((state) => {
      setIsConnected(state.isConnected);
    }).catch(() => {
      setIsConnected(false);
    });

    // Escucha cambios reactivos
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected);
    });
    return unsubscribe;
  }, []);

  return { isConnected };
}
