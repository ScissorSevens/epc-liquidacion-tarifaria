/**
 * Validadores puros del wizard SetupInicial (Fase 5 Tarea 5.1).
 *
 * Extraidos del componente `SetupInicial` para que las reglas de
 * validacion sean TESTEABLES sin necesidad de renderizar la UI. Las
 * funciones reciben un form (objeto plano con los strings del form)
 * y devuelven un mapa de errores por campo. La UI las consume via
 * `validarTodo()` antes de avanzar de paso o finalizar.
 *
 * Reglas del paso 1 (Datos del prestador):
 *   - nombre, nit, representante_legal, municipio, departamento REQ
 *   - representante_legal_cedula: 6-12 digitos (regex colombianas)
 *   - segmento: 1 o 2 (default 2 — rural, caso del 90% del programa)
 *   - num_suscriptores_urbanos / rurales: >= 0
 *   - email, telefono: OPT (no se validan)
 *
 * Reglas del paso 2 (Datos del primer operario):
 *   - cedula, nombre REQ
 *   - cedula: 6-12 digitos
 *   - password: >= 8 chars
 *   - confirmar_password: == password
 *   - email: OPT (no se valida)
 *   - consentimiento: true (Ley 1581/2012)
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface PrestadorForm {
  nombre: string;
  nit: string;
  representante_legal: string;
  representante_legal_cedula: string;
  municipio: string;
  departamento: string;
  segmento: 1 | 2;
  num_suscriptores_urbanos: number;
  num_suscriptores_rurales: number;
  email: string;
  telefono: string;
}

export interface OperarioForm {
  cedula: string;
  nombre: string;
  email: string;
  password: string;
  confirmar_password: string;
  consentimiento: boolean;
}

export type CampoFormPrestador = keyof PrestadorForm;
export type CampoFormOperario = keyof OperarioForm;

export type ErroresPrestador = Partial<Record<CampoFormPrestador, string>>;
export type ErroresOperario = Partial<Record<CampoFormOperario, string>>;

// ── Defaults ────────────────────────────────────────────────────────────────

export const PRESTADOR_FORM_VACIO: PrestadorForm = {
  nombre: '',
  nit: '',
  representante_legal: '',
  representante_legal_cedula: '',
  municipio: '',
  departamento: 'Cundinamarca',
  segmento: 2,
  num_suscriptores_urbanos: 0,
  num_suscriptores_rurales: 0,
  email: '',
  telefono: '',
};

export const OPERARIO_FORM_VACIO: OperarioForm = {
  cedula: '',
  nombre: '',
  email: '',
  password: '',
  confirmar_password: '',
  consentimiento: false,
};

// ── Constantes ──────────────────────────────────────────────────────────────

const REGEX_CEDULA = /^\d{6,12}$/;
const LONGITUD_PASSWORD_MINIMA = 8;

// ── Validador paso 1 ────────────────────────────────────────────────────────

export function validarPaso1(form: PrestadorForm): ErroresPrestador {
  const errores: ErroresPrestador = {};

  // nombre
  if (form.nombre.trim().length === 0) {
    errores.nombre = 'Nombre del prestador obligatorio';
  } else if (form.nombre.length > 200) {
    errores.nombre = 'Nombre no puede superar 200 caracteres';
  }

  // nit
  if (form.nit.trim().length === 0) {
    errores.nit = 'NIT obligatorio';
  } else if (form.nit.length > 20) {
    errores.nit = 'NIT no puede superar 20 caracteres';
  }

  // representante_legal
  if (form.representante_legal.trim().length === 0) {
    errores.representante_legal = 'Representante legal obligatorio';
  }

  // representante_legal_cedula (regex 6-12 digitos)
  const cedulaTrim = form.representante_legal_cedula.trim();
  if (cedulaTrim.length === 0) {
    errores.representante_legal_cedula = 'Cédula del representante obligatoria';
  } else if (!REGEX_CEDULA.test(cedulaTrim)) {
    errores.representante_legal_cedula = 'Cédula debe tener entre 6 y 12 dígitos numéricos';
  }

  // municipio
  if (form.municipio.trim().length === 0) {
    errores.municipio = 'Municipio obligatorio';
  } else if (form.municipio.length > 100) {
    errores.municipio = 'Municipio no puede superar 100 caracteres';
  }

  // departamento
  if (form.departamento.trim().length === 0) {
    errores.departamento = 'Departamento obligatorio';
  } else if (form.departamento.length > 100) {
    errores.departamento = 'Departamento no puede superar 100 caracteres';
  }

  // segmento
  if (form.segmento !== 1 && form.segmento !== 2) {
    errores.segmento = 'Segmento debe ser 1 (urbano) o 2 (rural)';
  }

  // num_suscriptores (>= 0)
  if (form.num_suscriptores_urbanos < 0) {
    errores.num_suscriptores_urbanos = 'Debe ser mayor o igual a 0';
  }
  if (form.num_suscriptores_rurales < 0) {
    errores.num_suscriptores_rurales = 'Debe ser mayor o igual a 0';
  }

  return errores;
}

// ── Validador paso 2 ────────────────────────────────────────────────────────

export function validarPaso2(form: OperarioForm): ErroresOperario {
  const errores: ErroresOperario = {};

  // cedula (regex 6-12 digitos)
  const cedulaTrim = form.cedula.trim();
  if (cedulaTrim.length === 0) {
    errores.cedula = 'Cédula obligatoria';
  } else if (!REGEX_CEDULA.test(cedulaTrim)) {
    errores.cedula = 'Cédula debe tener entre 6 y 12 dígitos numéricos';
  }

  // nombre
  if (form.nombre.trim().length === 0) {
    errores.nombre = 'Nombre obligatorio';
  }

  // password (>= 8 chars)
  if (form.password.length < LONGITUD_PASSWORD_MINIMA) {
    errores.password = `La contraseña debe tener al menos ${LONGITUD_PASSWORD_MINIMA} caracteres`;
  }

  // confirmar_password: REQ, debe coincidir con password
  if (form.confirmar_password.length === 0) {
    errores.confirmar_password = 'Debes confirmar la contraseña';
  } else if (form.confirmar_password !== form.password) {
    errores.confirmar_password = 'Las contraseñas no coinciden';
  }

  // consentimiento (Ley 1581/2012)
  if (!form.consentimiento) {
    errores.consentimiento = 'Debes aceptar el tratamiento de datos personales';
  }

  return errores;
}

// ── Helpers de conversion Form → Bootstrap ──────────────────────────────────

/**
 * Convierte el `PrestadorForm` de la UI al input que espera
 * `bootstrapCompleto()`. Mapea campos opcionales vacios a `undefined`
 * y aplica el `contacto` (el campo `telefono` se usa como contacto).
 */
export function prestadorFormABootstrap(form: PrestadorForm): {
  nombre: string;
  nit: string;
  representante_legal: string;
  representante_legal_cedula: string;
  municipio: string;
  departamento: string;
  segmento: 1 | 2;
  num_suscriptores_urbanos: number;
  num_suscriptores_rurales: number;
  contacto: string | null;
} {
  return {
    nombre: form.nombre.trim(),
    nit: form.nit.trim(),
    representante_legal: form.representante_legal.trim(),
    representante_legal_cedula: form.representante_legal_cedula.trim(),
    municipio: form.municipio.trim(),
    departamento: form.departamento.trim(),
    segmento: form.segmento,
    num_suscriptores_urbanos: form.num_suscriptores_urbanos,
    num_suscriptores_rurales: form.num_suscriptores_rurales,
    contacto: form.telefono.trim() || null,
  };
}
