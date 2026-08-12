# Setup local completo

**Última verificación:** agosto de 2026
**Aplica a:** commit `f8bf4fd` (branch `docs/handoff-epc-2026-08`)

Esta guía explica cómo levantar el sistema completo en una máquina de desarrollo desde cero. Asume Windows con PowerShell, Node.js 20+ y .NET 8 SDK instalados.

---

## Pre-requisitos

| Herramienta | Versión | Cómo verificar |
|---|---|---|
| Node.js | 20+ | `node --version` |
| npm | 10+ | `npm --version` |
| .NET SDK | 8.0+ | `dotnet --version` |
| Git | 2.40+ | `git --version` |
| Expo Go (celular) | última | instalar desde Play Store |

**Recomendado:** Visual Studio Code con extensiones ESLint, Prettier, React Native Tools.

---

## 1. Clonar el repositorio

```bash
git clone <url-del-repo>
cd sistema
```

---

## 2. Instalar dependencias

El proyecto usa npm workspaces. Las dependencias se instalan en la raíz y en cada workspace.

```bash
npm install
```

Esto instala las dependencias del workspace `mobile` automáticamente.

---

## 3. Levantar el backend (.NET)

### 3.1 Configurar la base de datos PostgreSQL

Asegurarse de que PostgreSQL 16 esté corriendo localmente. La connection string está en `backend/src/MediApp.Api/appsettings.json`:

```json
{
  "ConnectionStrings": {
    "Default": "Host=localhost;Database=mediapp;Username=<usuario>;Password=<password>"
  }
}
```

Actualizar el usuario y password según tu instalación local.

### 3.2 Aplicar migraciones

```bash
cd backend/src/MediApp.Api
dotnet ef database update
```

Si `dotnet-ef` no está instalado globalmente:

```bash
dotnet tool install --global dotnet-ef
```

### 3.3 Ejecutar el servidor

```bash
cd backend/src/MediApp.Api
dotnet run
```

El backend escucha en `http://localhost:5180` por defecto (ver `Properties/launchSettings.json`). Si necesitás que esté accesible desde otros dispositivos en la red LAN, el binding está configurado a `0.0.0.0:5180`.

**Verificar que funciona:**

```bash
curl http://localhost:5180/health
```

Debe responder con un JSON indicando que PostgreSQL responde.

---

## 4. Levantar la app móvil (Expo)

### 4.1 Configurar la URL del backend en la app

Por defecto, la app mobile busca el backend en la IP del servidor configurada en la pantalla **Config** de la app. Para dev local con Expo Go:

1. Averiguá la IP de tu máquina en la red WiFi (`ipconfig` en Windows).
2. En la app mobile, ir a **Config** y setear la URL: `http://<tu-ip>:5180`.

### 4.2 Iniciar Expo

```bash
cd mobile
EXPO_NO_VERSION_CHECK=1 npx expo start --clear
```

> **Por qué `--clear` + `EXPO_NO_VERSION_CHECK=1`:** evita caché stale y el warning de versión de Expo. Esta combinación está probada en este proyecto (ver engram: "no over-engineer start-dev.js").

### 4.3 Conectar un dispositivo

**Opción A: Expo Go en Android (recomendado para dev)**

1. Instalar Expo Go desde Play Store.
2. Escanear el QR que aparece en la terminal.
3. El dispositivo debe estar en la misma red WiFi que la máquina dev.

**Opción B: Emulador**

```bash
cd mobile
npx expo start --android
```

---

## 5. Setup inicial de la app (primer launch)

La primera vez que abrís la app, aparece el **wizard de setup inicial**:

1. **Paso 1:** configurar el prestador (nombre, NIT, altitud, etc.).
2. **Paso 2:** crear el primer operario admin (cédula, nombre, password).

Estos datos se guardan localmente en SQLite. Después podés crear más operarios desde la pantalla **Admin → Operarios** o desde el Dashboard web.

---

## 6. Verificar que todo funciona

### Tests automatizados

Desde la **raíz del proyecto**:

```bash
npm test
```

Debe mostrar **2123/2123 tests verde en 171 suites**.

> **Nota:** Este comando delega al workspace `mobile` donde está la config de jest con `preset: 'jest-expo'`. Si lo corrés y falla, ver `docs/TESTING.md` sección troubleshooting.

### Type check

```bash
cd mobile
npx tsc --noEmit
```

Debe retornar sin errores.

### Backend tests

```bash
cd backend
dotnet test
```

---

## Troubleshooting común

### `npm test` desde raíz falla con 186 suites

**Causa:** el script `test` en `package.json` raíz no está delegando correctamente al workspace `mobile`.

**Fix:** verificar que `package.json` raíz tenga `"test": "npm test --workspace=mobile"` (no `"jest"` directo). Si no, restaurar el fix del commit `c40fbae`.

### Expo no levanta / se queda colgado en "Starting Metro Bundler"

**Causa:** caché stale o warning de versión.

**Fix:** correr `EXPO_NO_VERSION_CHECK=1 npx expo start --clear` (no olvidar el `--clear`).

### Backend no se conecta a PostgreSQL

**Causa:** connection string incorrecta en `appsettings.json`.

**Fix:** verificar que `Host`, `Database`, `Username` y `Password` sean correctos. Probar con `psql -h localhost -U <usuario> -d mediapp`.

### Tests fallan con "Cannot find module 'expo'"

**Causa:** las dependencias no se instalaron correctamente.

**Fix:** borrar `node_modules` y reinstalar:

```bash
rm -rf node_modules mobile/node_modules
npm install
```

### El device no se conecta al backend

**Causa:** IP incorrecta o firewall bloqueando.

**Fix:**
1. Verificar la IP de tu máquina (`ipconfig` en Windows).
2. Configurar esa IP en la pantalla **Config** de la app.
3. Verificar que el firewall de Windows permita conexiones al puerto 5180.

### `dotnet ef` no se reconoce

**Causa:** la herramienta no está instalada globalmente.

**Fix:**

```bash
dotnet tool install --global dotnet-ef
```

Si ya está instalada pero no se reconoce, verificar que `%USERPROFILE%\.dotnet\tools` esté en el PATH.

---

## Próximo paso

Una vez que el setup funciona, leé `docs/ARCHITECTURE.md` para entender cómo se compone el sistema. Después `docs/CONVENTIONS.md` para conocer las convenciones del proyecto antes de empezar a hacer cambios.
