# Convenciones del proyecto

**Última actualización:** agosto de 2026
**Aplica a:** todo cambio de código, tests, docs o configuración

---

## Idioma y estilo

- **Español rioplatense (voseo)** en código, comentarios, docs y conversación:
  - "bien", "¿se entiende?", "es así de fácil", "dale", "che", "fijate", "tenés"
- **Inglés** solo para mensajes de commit y nombres de variables/funciones públicas de API.

## Conventional commits

- Mensajes en **inglés**, formato conventional commits (`type(scope): subject`).
- Subject **≤ 50 caracteres**.
- Body solo cuando el "why" no es obvio.
- **Sin** `Co-Authored-By`.
- **Sin** emojis en el mensaje.

**Tipos comunes:**

| Tipo | Cuándo usar |
|---|---|
| `feat` | Nueva feature |
| `fix` | Bug fix |
| `refactor` | Cambio de estructura sin cambiar comportamiento |
| `docs` | Solo documentación |
| `test` | Solo tests (sin cambio de código) |
| `chore` | Mantenimiento (deps, configs, gitignore) |
| `perf` | Mejora de performance |

**Scopes comunes:** `motor-tarifario`, `parametros-tarifa`, `mobile`, `backend`, `composicion`, `repo`, `ui`, `test`.

**Ejemplos:**

```
feat(parametros-tarifa): add flag aplica_cmaa opt-in
fix(mobile): resolve stale state on ParametrosTarifa return
refactor(admin): extract num() to utils/parse-numeric
docs(readme): update test count to 2123
test(motor-tarifario): add CMAA calculation tests
```

---

## Branches

| Branch | Propósito | Cuándo mergear |
|---|---|---|
| `main` | Producción, consolidada | Solo PRs aprobados desde `desarrollo` |
| `desarrollo` | Integración continua | Cuando los features acumulados están estables |
| `merge-desarrollo` | Limpieza de PR | Una vez mergeada a `main`, se cierra |
| `docs/<cambio>` | Docs (handoff, ADRs, etc.) | PR a `main` cuando está listo |

**Naming de feature branches:**

- `feat/<descripcion-corta>` para features nuevas
- `fix/<descripcion-corta>` para bug fixes
- `refactor/<descripcion-corta>` para refactors
- `docs/<descripcion-corta>` para docs

**Ejemplo:** `feat/cmip-calculation`, `fix/parametros-tarifa-stale-state`.

---

## SDD workflow (Spec-Driven Development)

Para cambios sustanciales, seguir el flujo:

```
proposal → specs → design → tasks → apply → verify → archive
```

1. **Proposal** (`openspec/changes/{nombre}/proposal.md`): intent + scope + enfoque.
2. **Specs** (`openspec/changes/{nombre}/specs/`): requisitos con Given/When/Then + RFC 2119.
3. **Design** (`openspec/changes/{nombre}/design.md`): decisiones B/B/B (Bueno/Barato/Breve) + tradeoffs.
4. **Tasks** (`openspec/changes/{nombre}/tasks.md`): checklist numerado completable por sesión.
5. **Apply**: implementación con TDD-strict (cada RED committeado antes del GREEN).
6. **Verify**: code review multi-axis (5 ejes: correctness, readability, architecture, security, performance).
7. **Archive**: move a `openspec/changes/archive/YYYY-MM-DD-{nombre}/`.

**Strict TDD mode** habilitado en `openspec/config.yaml`. Cada test rojo se commitea antes del feature.

**Persistencia:** hybrid (filesystem `openspec/` + Engram para cross-session recovery).

---

## TDD-strict

Para cada feature o fix:

1. **RED:** escribir el test que falla. Commit atómico.
2. **GREEN:** escribir el código mínimo para que pase. Commit atómico.
3. **REFACTOR:** mejorar la estructura sin cambiar comportamiento. Commit atómico (opcional).

**Convención de commits TDD:**

- `test(scope): description [RED]` — primer commit del test rojo
- `feat(scope): description [GREEN]` — commit que implementa
- `refactor(scope): description` — commit de mejora (sin test nuevo)

**NO hacer:**

- Commits que mezclen RED + GREEN en uno solo.
- Tests sin commitear por separado.
- Commits de "wip" o "fix tests".

---

## Estructura del código

### Módulos del dominio

Cada módulo en `mobile/src/{modulo}/` con:

```
{modulo}/
├── {modulo}.ts              # Lógica principal
├── types.ts                 # Tipos del dominio
├── __tests__/               # Tests colocados
│   ├── {modulo}.test.ts
│   └── casos-especiales.test.ts
└── utils.ts                 # Utilidades del módulo (si aplica)
```

### Persistencia (adaptadores)

Repos en `mobile/src/persistencia/expo-sqlite/`:

```
{entidad}-repository-expo-sqlite.ts   # Implementación del puerto
```

Con su test de integración en `__tests__/`.

### Pantallas (UI)

Pantallas en `mobile/src/pantallas/`:

```
pantallas/
├── admin/
│   ├── ParametrosTarifa.tsx           # Composition (orquesta subcomponentes)
│   ├── ParametrosTarifaPeriodo.tsx    # Subcomponente presentacional
│   ├── ParametrosTarifaCostos.tsx     # Subcomponente presentacional
│   └── ...
├── auth/
├── lecturas/
└── ...
```

**Regla:** las pantallas no contienen lógica de negocio. Solo orquestan subcomponentes y delegan al dominio.

---

## Tests

### Organización

- **Tests colocados:** cada módulo tiene su `__tests__/` adyacente.
- **No centralizados:** NO hay un `__tests__/` raíz.
- **Tests comportamentales:** escribí tests del comportamiento, no de la implementación.

### Mocks comunes

Los mocks están en `mobile/__tests__/__mocks__/`:

- `expo.js` — mock del módulo `expo`
- `expo-sqlite.js` — mock del módulo `expo-sqlite`
- `expo-vector-icons.js` — mock de `@expo/vector-icons`
- `expo-asset.js` — mock de `expo-asset`
- `@react-native-async-storage/async-storage.js` — mock de async-storage

### Cobertura

El proyecto genera reporte de cobertura en `coverage/` al correr `npm run test:coverage`. La meta es mantener cobertura alta en el dominio (`mobile/src/{modulo}/`), no necesariamente en UI (pantallas y componentes).

---

## Seguridad

- **Backend NO hashea contraseñas.** El cliente (mobile SHA-256, dashboard bcrypt) hashea antes del POST.
- **`passwordHash` NUNCA** se retorna en ninguna response del backend.
- **Token de sesión:** actualmente es `fake-token-{timestamp}`. Migración a GUID real planificada.
- **Sync idempotente:** el protocolo con `sync_registros` previene duplicados en reintentos.

---

## Multi-tenancy

- Cada operario pertenece a un único prestador.
- Todas las tablas tienen FK `id_prestador`.
- Todas las queries deben incluir `WHERE id_prestador = ?`.
- **NO** agregar datos globales sin filtrar por prestador.

---

## Mobile offline-first

- La captura funciona sin internet (lecturas, fotos, verificación de estrato).
- La sincronización contra el backend es **manual** desde la pantalla Sync.
- La cola respeta orden de dependencias: `suscriptor → medidor → lectura → liquidacion`.

---

## Comandos útiles

```bash
# Levantar Expo Go (con cache limpia + sin chequeo de versión)
cd mobile
EXPO_NO_VERSION_CHECK=1 npx expo start --clear

# Correr suite completa
cd sistema
npm test

# Correr con cobertura
cd sistema
npm run test:coverage

# Type check
cd mobile
npx tsc --noEmit

# Backend
cd backend/src/MediApp.Api
dotnet ef database update
dotnet run
```
