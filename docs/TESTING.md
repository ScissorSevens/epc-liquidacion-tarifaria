# Testing

**Última actualización:** agosto de 2026

Este documento explica cómo correr y escribir tests en el proyecto.

---

## Estado actual

- **2123 tests verde en 171 suites**
- **Cobertura:** ver `coverage/` después de correr `npm run test:coverage`
- **Runner:** `jest-expo` con preset configurado en `mobile/package.json`

---

## Comandos principales

### Suite completa

Desde la **raíz del proyecto**:

```bash
npm test
```

Esto delega al workspace `mobile` y corre todos los tests del dominio y mobile.

> **Histórico:** antes del fix `c40fbae`, este comando fallaba con 186 suites. El fix cambió los scripts de `package.json` raíz para delegar correctamente a `mobile`.

### Con cobertura

```bash
npm run test:coverage
```

Genera reporte de cobertura en `coverage/`. Abrir `coverage/lcov-report/index.html` en el browser para verlo.

### Solo mobile (acceso directo a jest)

```bash
cd mobile
npx jest
```

### Watch mode

```bash
cd mobile
npx jest --watch
```

O desde la raíz:

```bash
npm run test:watch
```

### Filtrar por path

```bash
cd mobile
npx jest --testPathPattern=motor-tarifario
```

### Filtrar por nombre

```bash
cd mobile
npx jest -t "calcularLiquidacion"
```

---

## Estructura de tests

### Tests colocados

Cada módulo del dominio tiene su `__tests__/` adyacente:

```
mobile/src/
├── motor-tarifario/
│   ├── motor-tarifario.ts
│   └── __tests__/
│       ├── motor-tarifario.test.ts
│       └── casos-especiales.test.ts
├── parametros-tarifa/
│   ├── parametros-tarifa.ts
│   └── __tests__/
│       └── parametros-tarifa.test.ts
└── ...
```

### Organización interna de un test file

```typescript
import { calcularLiquidacion } from '../motor-tarifario';

describe('motor-tarifario', () => {
  describe('calcularLiquidacion', () => {
    it('calcula correctamente con consumo básico', () => {
      // Arrange
      const entrada = { /* ... */ };

      // Act
      const resultado = calcularLiquidacion(entrada);

      // Assert
      expect(resultado.total).toBe(1500);
    });

    it('aplica subsidio para estrato 1', () => {
      // ...
    });
  });
});
```

**Convención:** usar `describe` para agrupar funciones, `it` para casos individuales.

---

## TDD-strict

Este proyecto usa **TDD-strict** (configurado en `openspec/config.yaml`). Cada feature o fix sigue el ciclo RED → GREEN → REFACTOR.

### Flujo

1. **RED:** escribir el test que falla.
   ```bash
   git add {test-file}
   git commit -m "test(scope): description [RED]"
   ```

2. **GREEN:** escribir el código mínimo para que pase.
   ```bash
   git add {impl-file}
   git commit -m "feat(scope): description [GREEN]"
   ```

3. **REFACTOR:** mejorar la estructura sin cambiar comportamiento.
   ```bash
   git add .
   git commit -m "refactor(scope): description"
   ```

### Convención en commits

- `[RED]` — primer commit del test rojo (debe fallar)
- `[GREEN]` — commit que implementa y hace pasar
- Sin sufijo — refactor o chore

**NO hacer:**

- Commits que mezclen RED + GREEN en uno solo.
- Tests sin commitear por separado.
- Commits de "wip" o "fix tests".

---

## Mocks comunes

Los mocks están en `mobile/__tests__/__mocks__/`:

| Mock | Para qué sirve |
|---|---|
| `expo.js` | Mock del módulo `expo` |
| `expo-sqlite.js` | Mock del módulo `expo-sqlite` |
| `expo-vector-icons.js` | Mock de `@expo/vector-icons` |
| `expo-asset.js` | Mock de `expo-asset` |
| `@react-native-async-storage/async-storage.js` | Mock de async-storage |

Los mocks están configurados automáticamente via `moduleNameMapper` en la config de jest del workspace `mobile`.

### Crear un mock nuevo

Si necesitás mockear un módulo nuevo:

1. Crear `mobile/__tests__/__mocks__/{nombre-modulo}.js`.
2. Agregar el `moduleNameMapper` en `mobile/package.json` sección `jest.moduleNameMapper`.
3. Documentar en este archivo qué hace el mock.

---

## Escribir tests comportamentales

**Regla de oro:** escribir tests del comportamiento, no de la implementación.

**❌ MAL (test de implementación):**

```typescript
it('llama a la función interna validarEstrato', () => {
  const spy = jest.spyOn(motor, 'validarEstrato');
  calcularLiquidacion(entrada);
  expect(spy).toHaveBeenCalled();
});
```

Este test es frágil: si refactoreás `validarEstrato` (la renombrás, la extraés), el test se rompe aunque el comportamiento siga correcto.

**✅ BIEN (test de comportamiento):**

```typescript
it('rechaza entrada con estrato fuera de rango', () => {
  const entrada = { /* ... */ estrato: 7 };
  expect(() => calcularLiquidacion(entrada)).toThrow();
});
```

Este test verifica lo que importa: que entradas inválidas sean rechazadas. Es robusto a refactors.

---

## Tests de integración

Los tests de integración usan `better-sqlite3` (Node.js) para correr SQLite en memoria. No requieren emulador ni Expo.

```typescript
import BetterSqlite3 from 'better-sqlite3';
import { SuscriptorRepositoryExpoSQLite } from '../suscriptor-repository-expo-sqlite';

describe('SuscriptorRepositoryExpoSQLite (integration)', () => {
  let db: BetterSqlite3.Database;
  let repo: SuscriptorRepositoryExpoSQLite;

  beforeEach(() => {
    db = new BetterSqlite3(':memory:');
    db.exec(`CREATE TABLE suscriptores (...);`);
    repo = new SuscriptorRepositoryExpoSQLite(db);
  });

  afterEach(() => {
    db.close();
  });

  it('guarda y lista suscriptores', async () => {
    await repo.guardar({ /* ... */ });
    const suscriptores = await repo.listar();
    expect(suscriptores).toHaveLength(1);
  });
});
```

---

## Tests de UI (componentes)

Para tests de componentes React Native, usar `@testing-library/react-native`.

```typescript
import { render, fireEvent } from '@testing-library/react-native';
import { ParametrosTarifaCostos } from '../ParametrosTarifaCostos';

describe('ParametrosTarifaCostos', () => {
  it('renderiza inputs de costos', () => {
    const { getByLabelText } = render(<ParametrosTarifaCostos onChange={jest.fn()} />);
    expect(getByLabelText('Cargo fijo')).toBeTruthy();
    expect(getByLabelText('Precio m³ básico')).toBeTruthy();
  });

  it('llama onChange al cambiar precio m³', () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(<ParametrosTarifaCostos onChange={onChange} />);
    fireEvent.changeText(getByLabelText('Precio m³ básico'), '1500');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ precioM3: 1500 }));
  });
});
```

---

## Troubleshooting

### `npm test` desde raíz falla con 186 suites

**Causa:** el script `test` en `package.json` raíz no delega al workspace `mobile`.

**Fix:** verificar que `package.json` raíz tenga `"test": "npm test --workspace=mobile"`. Si no, restaurar el fix del commit `c40fbae`.

Ver más detalles en `docs/SETUP.md` sección troubleshooting.

### Tests lentos

**Causa:** correr toda la suite + setup de mocks.

**Optimizaciones:**

1. Usar `--testPathPattern` para filtrar.
2. Usar `--maxWorkers=2` si tenés poca RAM.
3. Usar `--silent` para reducir output.

### Tests intermitentes (flaky)

**Causa:** dependencias de timing (timers, promesas no esperadas).

**Fix:**

1. Usar `jest.useFakeTimers()` cuando dependan de `setTimeout`/`setInterval`.
2. Usar `await` consistentemente con promesas.
3. Verificar que los mocks de módulos nativos estén bien configurados.

### `Cannot find module 'expo'` u otro módulo nativo

**Causa:** mock no configurado.

**Fix:** verificar que el módulo esté en `moduleNameMapper` de `mobile/package.json` y que el mock exista en `mobile/__tests__/__mocks__/`.

### TypeScript errors en tests

**Causa:** tipos mal inferidos o `tsconfig` desactualizado.

**Fix:**

1. Correr `npx tsc --noEmit` para ver los errores exactos.
2. Verificar que el archivo de test tenga los tipos correctos.
3. Si el error es de un mock, agregar `as any` o definir tipos en el mock.

---

## Cobertura

### Ver reporte

Después de `npm run test:coverage`:

```bash
# Abrir reporte HTML
open coverage/lcov-report/index.html

# O ver resumen en consola
cat coverage/lcov-report/index.html | grep -oP 'class="strong">\K[^<]+'
```

### Meta de cobertura

- **Dominio (`mobile/src/{modulo}/`):** meta 90%+
- **Repositorios (`mobile/src/persistencia/`):** meta 85%+
- **UI (`mobile/src/pantallas/`, `componentes/`):** no hay meta estricta, pero tests de comportamiento son bienvenidos.

---

## Recursos

- [Jest docs](https://jestjs.io/docs/getting-started)
- [jest-expo preset](https://docs.expo.dev/guides/testing-with-jest/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [`docs/CONVENTIONS.md`](./CONVENTIONS.md) — convenciones del proyecto
