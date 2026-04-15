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
