# Sistema de Liquidación Tarifaria — EPC Cundinamarca

Motor de liquidación tarifaria para prestadores rurales de agua potable.  
Desarrollado bajo normativa CRA, con enfoque offline-first para trabajo en campo.

## Stack

- **Lenguaje**: TypeScript
- **Testing**: Jest + ts-jest (TDD)
- **CI/CD**: GitHub Actions

## Estructura

```
src/
└── motor-tarifario/     # Lógica de cálculo tarifario CRA
    ├── types.ts          # Tipos e interfaces
    ├── motor-tarifario.ts
    ├── index.ts
    └── __tests__/        # Tests unitarios (TDD)
```

## Comandos

```bash
npm test              # Ejecutar tests
npm run test:watch    # Tests en modo watch (TDD)
npm run test:coverage # Tests con reporte de cobertura
npm run build         # Compilar TypeScript
```

## Ciclo TDD

Cada funcionalidad se desarrolla en tres pasos:

1. 🔴 **Red** — escribir el test que falla
2. 🟢 **Green** — implementar lo mínimo para que pase
3. 🔵 **Refactor** — limpiar sin romper tests

## App móvil (`mobile/`)

Proyecto Expo + TypeScript que reusa el dominio TS desde `../src` vía path
mapping `@dominio/*` (Opción 2 monorepo "lazy", sin workspaces npm/yarn).

### Arrancar dev server

```bash
cd mobile
npm install        # primera vez (~700 paquetes, ~45 s)
npx expo start     # abre el dev server, muestra QR
```

Escaneá el QR con **Expo Go** en Android (mismo WiFi que el PC). Si la red lo
bloquea, usá `npx expo start --tunnel` (más lento, pero atraviesa NAT).

### Stack móvil

- React Native vía **Expo SDK 54** (managed workflow)
- React 19, RN 0.81, TypeScript 5.9 strict
- Metro configurado para observar `../src` y resolver `@dominio/*`
- Wiring del dominio en `mobile/src/composition/bootstrap.ts`

### Tests del wiring

Los tests del bootstrap móvil corren con el **jest del root** (no se instala
otra copia en `mobile/`). Lanzá todo con `npm test` desde la raíz.
