# 2. Desarrollo del módulo de facturación

**Indicador de medida:** Facturas generadas automáticamente
**Fecha de inicio:** 6/07/2026
**Fecha de terminación:** 18/07/2026
**% Avance:** 5%

## Resumen ejecutivo

Esta actividad cubre el desarrollo end-to-end del flujo de facturación: desde la captura de lecturas en campo hasta la generación de facturas con persistencia local. Incluye la transacción atómica de operaciones sensibles, la auto-vinculación de dispositivos en login y optimizaciones de performance con selectores Zustand específicos.

## Trabajo realizado

- **Transacciones atómicas:** signup de suscriptores con medidor, enqueue de lecturas, y bootstrap inicial de tenant mobile — todas dentro de transacciones SQLite para evitar estados inconsistentes.
- **Auto-vinculación de dispositivo en login:** si el operario no tiene dispositivo vinculado, se vincula automáticamente al primero disponible en lugar de bloquear el flujo.
- **Device-id helper:** extracción de `getDeviceId()` a módulo shared para reuso.
- **Optimizaciones con selectores Zustand específicos** (más granulares que los previos): `id_prestador_activo`, `cambiarPrestadorYCargarContexto`,.Admin, `ParametrosTarifa`, `GestionPrestadores`, `AcuerdoMunicipal`, `WorkspaceSwitcher` — evita re-renders en cambios no relacionados.
- **Whitelist de actualizaciones parciales de suscriptores:** permite PATCH con subset de campos sin perder los no enviados.
- **Compatibilidad API:** accept `Operario` payload sin `password_hash` desde la API.
- **Expo 54.0.35 → 54.0.36:** bump para mejor compatibilidad con SDK instalado.
- **TS config:** inline `tsconfig.base` para resolver errores del editor.
- **Profile flow:** drop de "profile device-link" screen (redundante) y fix de "resolve profile by linked device".

## Evidencia

- **Commits:** 147 commits en el rango 06/07-18/07/2026 (período de alta actividad en mobile)
- **Archivos clave:**
  - `mobile/src/persistencia/expo-sqlite/` (transacciones)
  - `mobile/src/composition/` (bootstrap device-link)
  - `mobile/src/store/` (selectores Zustand específicos)
- **Métrica:** 0 errores de transaccionalidad en testing manual del flujo de facturación

## Estado

✅ **Completo.** Las facturas se generan correctamente desde la captura de lecturas, con persistencia transaccional y sync idempotente.
