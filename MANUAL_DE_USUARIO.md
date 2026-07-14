# Manual de Usuario
## Sistema de Liquidación Tarifaria EPC

**Versión:** 1.0  
**Fecha:** 10 de mayo de 2026  
**Autor:** Felipe Bernal Pachón  
**Cliente:** Empresas Públicas de Cundinamarca (EPC)  
**Universidad:** Universidad de Cundinamarca

---

## Tabla de Contenidos

1. [Introducción](#1-introducción)
2. [Perfil Operario — Aplicación Móvil](#2-perfil-operario--aplicación-móvil)
   - 2.1 [Requisitos del dispositivo](#21-requisitos-del-dispositivo)
   - 2.2 [Pantalla INICIO — Ruta de Hoy](#22-pantalla-inicio--ruta-de-hoy)
   - 2.3 [Pantalla LECTURAS — Captura de Medidores](#23-pantalla-lecturas--captura-de-medidores)
   - 2.4 [Pantalla SYNC — Sincronización](#24-pantalla-sync--sincronización)
   - 2.5 [Pantalla CONFIG — Configuración](#25-pantalla-config--configuración)
   - 2.6 [Flujo completo del operario](#26-flujo-completo-del-operario)
3. [Perfil Administrador — Dashboard Web](#3-perfil-administrador--dashboard-web)
   - 3.1 [Acceso al dashboard](#31-acceso-al-dashboard)
   - 3.2 [Gestión de Operarios](#32-gestión-de-operarios)
   - 3.3 [Consulta de Suscriptores](#33-consulta-de-suscriptores)
   - 3.4 [Consulta de Lecturas](#34-consulta-de-lecturas)
   - 3.5 [Consulta de Liquidaciones](#35-consulta-de-liquidaciones)
4. [Glosario](#4-glosario)
5. [Configuración inicial y login](#configuración-inicial-y-login)

---

## 1. Introducción

El **Sistema de Liquidación Tarifaria EPC** es una solución informática diseñada para automatizar la captura de lecturas de medidores de agua y el cálculo de la liquidación tarifaria según la normativa CRA (Comisión de Regulación de Agua Potable y Saneamiento Básico).

El sistema cuenta con dos componentes principales:

| Componente | Descripción | Usuarios |
|---|---|---|
| **Aplicación Móvil** | App Android (Expo/React Native) para captura offline de lecturas en campo | Operarios |
| **Dashboard Web** | Panel de administración accesible desde el navegador | Administradores |

### Principio de operación offline-first

La aplicación móvil funciona **sin conexión a internet**. Las lecturas se almacenan localmente en el dispositivo y se sincronizan con el servidor cuando el operario lo decide manualmente. Esto garantiza la operación en zonas rurales con cobertura limitada.

---

## 2. Perfil Operario — Aplicación Móvil

### 2.1 Requisitos del dispositivo

- Sistema operativo: Android 10 o superior
- Espacio disponible: mínimo 100 MB
- Cámara: recomendada para captura de evidencia fotográfica
- Conexión a internet: **no requerida** durante la captura de lecturas; necesaria solo para sincronizar

### 2.2 Pantalla INICIO — Ruta de Hoy

Al abrir la aplicación, el operario ve la pantalla **INICIO** con:

- **Fecha del día** (día de la semana, número y mes)
- **Barra de progreso** de lecturas capturadas: `X / Total capturadas`
- **Lista de suscriptores** asignados para lectura ese día
- **Banner de modo offline** (visible cuando no hay conexión)
- **Botón sticky "SINCRONIZAR (N pendientes)"** — aparece automáticamente cuando hay lecturas pendientes de envío al servidor

#### Acciones disponibles

| Acción | Cómo hacerlo |
|---|---|
| Ver detalle de un suscriptor | Tocar la tarjeta del suscriptor en la lista |
| Ir directamente a sincronizar | Tocar el botón "SINCRONIZAR (N pendientes)" |

#### Estados posibles del banner

- **Sin conexión — los datos se guardarán acá**: el dispositivo no tiene internet; las lecturas se guardan localmente sin problema.

---

### 2.3 Pantalla LECTURAS — Captura de Medidores

Accesible desde la tab **LECTURAS** o tocando un suscriptor en la pantalla INICIO.

#### 2.3.1 Lista de Suscriptores

Muestra todos los suscriptores disponibles en la base de datos local. Se puede:
- Buscar por nombre o código
- Tocar un suscriptor para ver su detalle

#### 2.3.2 Detalle del Suscriptor

Muestra los datos del suscriptor y su medidor asociado:
- Nombre y apellidos
- Dirección
- Estrato
- Código

Desde aquí se puede iniciar la captura de lectura.

#### 2.3.3 Captura de Lectura

Pantalla para registrar la lectura del medidor:

| Campo | Descripción |
|---|---|
| **Lectura actual** | Valor en m³ que marca el medidor (campo obligatorio) |
| **Observaciones** | Texto libre opcional para reportar anomalías |
| **Foto de evidencia** | Foto del medidor tomada con la cámara (opcional pero recomendada) |

Al confirmar la lectura:
1. El sistema calcula automáticamente el **consumo** (lectura actual − lectura anterior)
2. Aplica el **motor tarifario** según el estrato del suscriptor
3. Muestra el **resultado del cálculo** (cargo fijo + cargo variable + subsidio/contribución)
4. Guarda la lectura y la liquidación en la base de datos local
5. Encola el envío al servidor

> **Nota:** El cargo fijo puede ser $0 según el Decreto 0776/2025 (mínimo vital de agua).

#### 2.3.4 Resultado del Cálculo

Pantalla que muestra el desglose de la liquidación:
- Consumo en m³
- Cargo fijo (CF)
- Cargo por consumo básico (hasta 20 m³)
- Cargo por consumo excedente (si aplica, por encima de 20 m³)
- Subsidio (estratos 1, 2, 3) o contribución (estratos 5, 6)
- **Total a cobrar**

#### 2.3.5 Alta de Nuevo Suscriptor

Desde la tab LECTURAS también es posible registrar un nuevo suscriptor directamente desde el dispositivo. Los datos se sincronizan con el servidor al conectarse.

#### 2.3.6 Importar CSV

Permite importar un archivo CSV con suscriptores y medidores para poblar la base de datos local sin necesidad de sincronización con el servidor.

---

### 2.4 Pantalla SYNC — Sincronización

Accesible desde la tab **SYNC**.

Esta pantalla permite al operario enviar al servidor todas las lecturas, suscriptores y medidores capturados offline.

#### Panel de estado

| Indicador | Descripción |
|---|---|
| **ESTADO** | Conexión estable / Sin conexión / Estado desconocido |
| **EXITOSOS** | Cantidad de registros enviados correctamente |
| **FALLIDOS** | Cantidad de registros que no pudieron enviarse |
| **PENDIENTES** | Cantidad de registros en espera de envío |

#### Botones disponibles

| Botón | Qué hace |
|---|---|
| **SINCRONIZAR AHORA** | Procesa la cola completa y envía al servidor |
| **PROBAR CONEXIÓN** | Verifica si el backend responde (hace ping a `/health`) |
| **VER COLA** | Muestra el detalle de los items pendientes |

#### Log de eventos

Debajo de los botones se muestra un registro de los últimos eventos de la sesión actual (health checks, resultados de sync, errores). Este log **no persiste** al cerrar la aplicación.

#### Cuándo sincronizar

Se recomienda sincronizar:
- Al finalizar la jornada de trabajo
- Cuando el botón sticky "SINCRONIZAR (N pendientes)" aparece en la pantalla INICIO
- Siempre que el dispositivo tenga conexión a internet disponible

---

### 2.5 Pantalla CONFIG — Configuración

Accesible desde la tab **CONFIG**.

Permite al operario configurar la **URL del servidor backend** al que se conectará la aplicación para sincronizar. Esta URL la proporciona el administrador del sistema.

---

### 2.6 Flujo completo del operario

```
Inicio del día
     │
     ▼
[INICIO] Ver ruta del día
     │
     ├─► Seleccionar suscriptor
     │         │
     │         ▼
     │   [LECTURAS] Ingresar lectura actual
     │         │
     │         ├── Tomar foto de evidencia (opcional)
     │         │
     │         ▼
     │   [RESULTADO] Ver liquidación calculada
     │         │
     │         ▼
     │   Guardado local + encolado automático
     │
     │  (Repetir por cada suscriptor)
     │
     ▼
Fin del día (con conexión disponible)
     │
     ▼
[SYNC] Sincronizar ahora → datos enviados al servidor
```

---

## 3. Perfil Administrador — Dashboard Web

### 3.1 Acceso al dashboard

El dashboard es una aplicación web estática accesible desde cualquier navegador moderno:

```
http://<dirección-del-servidor>:5180
```

> La dirección exacta la provee el equipo técnico de EPC.

No se requiere instalación. El dashboard funciona directamente en el navegador.

### 3.2 Gestión de Operarios

El administrador puede gestionar los operarios del sistema:

#### Crear operario

Para registrar un nuevo operario:

| Campo | Descripción | Obligatorio |
|---|---|---|
| **Número de cédula** | Documento de identidad único | Sí |
| **Nombre completo** | Nombre y apellidos | Sí |
| **Correo electrónico** | Email único del operario | Sí |
| **Contraseña** | Se hashea en el cliente antes de enviar (bcrypt, cost 10) | Sí |
| **Rol** | Rol del operario en el sistema | Sí |
| **Estado** | `activo` o `inactivo` | Sí |

> **Importante:** La contraseña **nunca** se almacena en texto plano. El sistema aplica hash bcrypt con factor de costo 10 antes de enviarla al servidor.

#### Listar operarios

La tabla de operarios muestra:
- ID, cédula, nombre, email, rol, estado, dispositivo vinculado, fecha de creación

Se puede filtrar por **solo activos** usando el checkbox correspondiente.

#### Editar operario

Permite actualizar nombre, email, rol y estado de un operario existente. La cédula no puede modificarse.

#### Vincular dispositivo

Operación que asocia el ID único de un dispositivo móvil a un operario. Esto permite identificar desde qué dispositivo se sincronizaron los datos.

### 3.3 Consulta de Suscriptores

Tabla de todos los suscriptores registrados en el sistema, ordenados por código:

| Columna | Descripción |
|---|---|
| Código | Identificador único del suscriptor |
| Nombre y apellidos | Nombre completo |
| Dirección | Dirección del predio |
| Estrato | Estrato socioeconómico (1–6) |
| Matrícula inmobiliaria | Número de matrícula |
| Número catastral | Código catastral del predio |
| Estado | `activo` o `inactivo` |
| Fecha de creación | Cuándo fue registrado en el sistema |

### 3.4 Consulta de Lecturas

Tabla de lecturas sincronizadas, ordenadas de más reciente a más antigua:

| Columna | Descripción |
|---|---|
| Período | Mes/año de la lectura (YYYYMM) |
| Lectura actual | Valor en m³ capturado |
| Lectura anterior | Valor en m³ del período anterior |
| Consumo m³ | Diferencia calculada automáticamente |
| Timestamp captura | Fecha y hora exacta en que el operario registró la lectura |
| Observaciones | Notas del operario |
| Foto evidencia | Enlace a la foto del medidor (si se capturó) |
| Número medidor | Número del medidor |
| Suscriptor | Nombre del suscriptor asociado |

### 3.5 Consulta de Liquidaciones

Tabla de liquidaciones calculadas y sincronizadas. Permite al administrador revisar los montos calculados por el motor tarifario antes de emitir las facturas.

> ⚠️ La emisión y distribución de facturas físicas **no está implementada** en este sistema. El sistema calcula y almacena los montos; la facturación formal se gestiona por fuera del sistema.

---

## 4. Glosario

| Término | Definición |
|---|---|
| **Cargo fijo (CF)** | Valor mensual que paga el suscriptor independientemente del consumo. Puede ser $0 por mínimo vital (Decreto 0776/2025). |
| **Cargo por consumo (CC)** | Valor calculado según el volumen de agua consumida en m³. |
| **Consumo básico** | Los primeros 20 m³ consumidos por período, con tarifa preferencial. |
| **Consumo excedente** | Consumo por encima de 20 m³, con tarifa más alta. |
| **CRA** | Comisión de Regulación de Agua Potable y Saneamiento Básico. |
| **Estrato** | Clasificación socioeconómica del predio (1 al 6). Determina si el suscriptor recibe subsidio (1–3) o paga contribución (5–6). El estrato 4 no tiene subsidio ni contribución. |
| **Factor ISE** | Índice de Suficiencia Económica. Incorporado por el administrador en los parámetros tarifarios antes de ingresar CF y CC al sistema. |
| **Medidor** | Instrumento de medición del consumo de agua en m³, instalado en el predio del suscriptor. |
| **Mínimo vital** | Volumen mínimo de agua garantizado por el Estado (Decreto 0776/2025). Si el consumo es ≤ al mínimo vital, el cargo fijo es $0. |
| **Motor tarifario** | Módulo del sistema que aplica las fórmulas de la CRA para calcular el valor a cobrar. Implementa 2 bloques: básico y excedente. |
| **Período** | Mes de facturación, expresado como YYYYMM (ej. 202605 = mayo 2026). |
| **Res. CRA 688/2014** | Resolución que define la metodología tarifaria vigente para acueducto y alcantarillado. |
| **Sincronización** | Proceso de envío de datos capturados offline al servidor backend. Manual, iniciado por el operario. |
| **SQLite** | Motor de base de datos local embebido en el dispositivo móvil. No requiere servidor. |
| **Suscriptor** | Usuario del servicio de acueducto registrado en el sistema. |

---

## Configuración inicial y login

### Primera vez — Setup inicial

Cuando abrís la app por primera vez en un dispositivo nuevo, la app te guía por un wizard de 2 pasos para configurar el prestador y crear el primer operario.

#### Paso 1: Datos del prestador

El encabezado muestra **"Paso 1 de 2 — Datos del prestador"**.

Campos obligatorios:
- **Nombre** del prestador
- **NIT**
- **Representante legal** (nombre completo)
- **Cédula del representante** (6 a 12 dígitos numéricos)
- **Municipio**
- **Departamento** (valor inicial: Cundinamarca)
- **Segmento** (1 urbano o 2 rural; valor inicial: 2)
- **N° suscriptores urbanos** (valor inicial: 0)
- **N° suscriptores rurales** (valor inicial: 0)

Campos opcionales:
- **Email corporativo**
- **Teléfono**

Tocá **[SIGUIENTE]** para validar los datos y avanzar al segundo paso.

#### Paso 2: Datos del primer operario

El encabezado muestra **"Paso 2 de 2 — Datos del primer operario"**.

Campos obligatorios:
- **Cédula** (6 a 12 dígitos)
- **Nombre completo**
- **Contraseña** (mínimo 8 caracteres)
- **Confirmar contraseña** (debe coincidir con la contraseña)

Campo opcional:
- **Email**

También debés activar el control obligatorio **"Acepto el tratamiento de mis datos personales según la Ley 1581/2012"**.

Tocá **[FINALIZAR]** para crear la configuración local y entrar a la aplicación.

### Login (después del setup)

Cuando vuelvas a abrir la app y no haya una sesión vigente, aparece la pantalla de Login:

- **Cédula** (6 a 12 dígitos)
- **Contraseña** (mínimo 8 caracteres)
- Botón **[INGRESAR]**

**Si la cédula no existe** en la base de datos local, la app muestra: "No encontramos un operario con esa cédula. Verificá que hayas completado el setup inicial o contactá al administrador."

**Si la contraseña es incorrecta**, la app muestra: "La contraseña no coincide. Intentá de nuevo."

**Si tu sesión anterior venció**, la app muestra un banner amarillo arriba del formulario: "Tu sesión anterior venció. Volvé a ingresar tu cédula y contraseña."

### Cerrar sesión

1. Andá a **Mi Perfil** (ícono de persona en la barra de navegación inferior).
2. Desplazate hasta la sección **Gestión**.
3. Tocá **"Cerrar sesión"**.
4. Confirmá tocando **"Cerrar sesión"** en el diálogo.

La app limpia la sesión y el prestador activo del espacio de trabajo, y vuelve al Login.

### Sesión vencida

La sesión dura **24 horas**. Si volvés a abrir la app después de ese plazo, aparece un banner amarillo arriba del Login: "Tu sesión anterior venció. Volvé a ingresar tu cédula y contraseña."

Podés tocar la **X** del banner para cerrarlo. Después ingresá tu cédula y contraseña normalmente.
