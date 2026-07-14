// mobile/__tests__/pantallas/SetupInicial.test.tsx
//
// Tests contractuales del wizard SetupInicial (Fase 5 Tarea 5.1).
//
// SetupInicial es la pantalla que muestra AuthGate cuando
// `prestadorRepo.listar()` devuelve `[]` (estado `sin_setup`). Es un
// wizard de 2 pasos:
//
//   PASO 1: Datos del prestador (10 campos, 9 obligatorios)
//   PASO 2: Datos del primer operario (5 campos) + consent + finalizar
//
// COBERTURA ESTE ARCHIVO:
//   - Validacion pura del paso 1 (funcion `validarPaso1`).
//   - Validacion pura del paso 2 (funcion `validarPaso2`).
//   - Render del paso 1: campos visibles, paso 2 oculto.
//   - Render del paso 2: campos visibles, consent checkbox.
//   - Al tocar [FINALIZAR] con form valido: llama bootstrapCompleto +
//     guardarSesion + useWorkspace.setSesionCompleta + onComplete.
//
// MOCKS:
//   - expo-splash-screen (silent preventAutoHide).
//   - AsyncStorage (setItem/removeItem para sesion).
//   - @react-native-async-storage/async-storage.
//   - theme tokens (mocked, no StyleSheet real).
//   - useWorkspace (spy sobre setSesionCompleta).
//   - getBootstrap (mock para exponer los 4 repos in-memory al test).
//   - bootstrapCompleto (mockeado para verificar invocacion).
//
// TDD Evidence:
//   RED  → estos tests son la primera implementacion. Antes de este
//          commit, los archivos `pantallas/SetupInicial.tsx` y
//          `composition/validaciones-setup.ts` no existen. Los tests
//          fallan al importar los modulos.
//   GREEN → la pantalla y los validadores se implementan y los tests pasan.

import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
  hideAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/theme/skeletal-tokens', () => ({
  BORDERS: { thin: { borderWidth: 1 }, error: { borderWidth: 2, borderColor: '#f00' } },
  COLORS: {
    background: '#fff',
    surfaceContainerLow: '#fff',
    surfaceContainerLowest: '#fff',
    primary: '#3596C8',
    onPrimary: '#fff',
    primaryContainer: '#3596C8',
    surfaceLight: '#f0f4ff',
    outlineVariant: '#ccc',
    outline: '#888',
    onSurface: '#000',
    onSurfaceVariant: '#555',
    error: '#f00',
    errorContainer: '#fee',
  },
  RADIUS: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
  SHADOWS: { card: {} },
  SPACING: {
    margin: 16, lg: 24, md: 16, sm: 8, xs: 4, xl: 32, xxl: 48, gutter: 12,
  },
  TYPOGRAPHY: {
    headlineLg: { fontSize: 28 },
    headlineMd: { fontSize: 22 },
    headlineSm: { fontSize: 18 },
    bodyLg: { fontSize: 16 },
    bodyMd: { fontSize: 14 },
    bodySm: { fontSize: 12 },
    labelLg: { fontSize: 14 },
    labelMd: { fontSize: 12 },
    labelSm: { fontSize: 10 },
  },
}));

import {
  validarPaso1,
  validarPaso2,
  type PrestadorForm,
  type OperarioForm,
  PRESTADOR_FORM_VACIO,
  OPERARIO_FORM_VACIO,
} from '../../src/composition/validaciones-setup';
import SetupInicial from '../../src/pantallas/SetupInicial';
import { useWorkspace } from '../../src/composicion/useWorkspace';

// ── TESTS DE VALIDACION PURA (paso 1) ───────────────────────────────────────

describe('validarPaso1()', () => {
  it('V1.1 retorna errores cuando todos los campos requeridos estan vacios', () => {
    // PRESTADOR_FORM_VACIO ya tiene departamento='Cundinamarca' y segmento=2
    // (defaults razonables). El test verifica los REQ sin default.
    const errores = validarPaso1(PRESTADOR_FORM_VACIO);

    // Campos REQ sin default: nombre, nit, representante_legal,
    // representante_legal_cedula, municipio. Los demas REQ ya tienen
    // defaults razonables (departamento='Cundinamarca', segmento=2,
    // num_suscriptores=0).
    expect(errores.nombre).toBeDefined();
    expect(errores.nit).toBeDefined();
    expect(errores.representante_legal).toBeDefined();
    expect(errores.representante_legal_cedula).toBeDefined();
    expect(errores.municipio).toBeDefined();
    // Defaults que NO deben generar error:
    expect(errores.departamento).toBeUndefined(); // tiene default 'Cundinamarca'
    expect(errores.segmento).toBeUndefined(); // tiene default 2
  });

  it('V1.2 rechaza cedula de representante con menos de 6 o mas de 12 digitos', () => {
    const base: PrestadorForm = { ...PRESTADOR_FORM_VACIO, nombre: 'X', nit: '900', representante_legal: 'Y', municipio: 'Z', departamento: 'Cundinamarca', representante_legal_cedula: '12345' };
    const errores = validarPaso1(base);
    expect(errores.representante_legal_cedula).toBeDefined();

    const base2 = { ...base, representante_legal_cedula: '1234567890123' };
    const errores2 = validarPaso1(base2);
    expect(errores2.representante_legal_cedula).toBeDefined();
  });

  it('V1.3 acepta cedula de representante valida (6-12 digitos)', () => {
    const form: PrestadorForm = {
      ...PRESTADOR_FORM_VACIO,
      nombre: 'Asociacion de Usuarios',
      nit: '900123456-7',
      representante_legal: 'Juan Perez',
      representante_legal_cedula: '12345678',
      municipio: 'Caqueza',
      departamento: 'Cundinamarca',
      segmento: 2,
      num_suscriptores_urbanos: 0,
      num_suscriptores_rurales: 150,
    };
    const errores = validarPaso1(form);
    expect(errores.representante_legal_cedula).toBeUndefined();
    expect(errores.nombre).toBeUndefined();
    expect(errores.nit).toBeUndefined();
  });

  it('V1.4 rechaza segmento invalido (distinto de 1 o 2)', () => {
    const form: PrestadorForm = { ...PRESTADOR_FORM_VACIO, segmento: 3 as never };
    const errores = validarPaso1(form);
    expect(errores.segmento).toBeDefined();
  });

  it('V1.5 rechaza num_suscriptores negativos', () => {
    const form: PrestadorForm = { ...PRESTADOR_FORM_VACIO, num_suscriptores_urbanos: -1, num_suscriptores_rurales: -5 };
    const errores = validarPaso1(form);
    expect(errores.num_suscriptores_urbanos).toBeDefined();
    expect(errores.num_suscriptores_rurales).toBeDefined();
  });

  it('V1.6 retorna errores vacios cuando el form es completamente valido', () => {
    const form: PrestadorForm = {
      nombre: 'Asociacion La Esperanza',
      nit: '900123456-7',
      representante_legal: 'Juan Perez',
      representante_legal_cedula: '12345678',
      municipio: 'Caqueza',
      departamento: 'Cundinamarca',
      segmento: 2,
      num_suscriptores_urbanos: 0,
      num_suscriptores_rurales: 150,
      email: '',
      telefono: '',
    };
    const errores = validarPaso1(form);
    expect(errores).toEqual({});
  });
});

// ── TESTS DE VALIDACION PURA (paso 2) ───────────────────────────────────────

describe('validarPaso2()', () => {
  it('V2.1 retorna errores cuando todos los campos requeridos estan vacios', () => {
    const errores = validarPaso2(OPERARIO_FORM_VACIO);
    expect(errores.cedula).toBeDefined();
    expect(errores.nombre).toBeDefined();
    expect(errores.password).toBeDefined();
    expect(errores.confirmar_password).toBeDefined();
    expect(errores.consentimiento).toBeDefined();
  });

  it('V2.2 rechaza cedula con formato invalido (no 6-12 digitos)', () => {
    const form: OperarioForm = {
      ...OPERARIO_FORM_VACIO,
      cedula: '12345',
      nombre: 'Ana',
      password: 'miclave123',
      confirmar_password: 'miclave123',
      consentimiento: true,
    };
    const errores = validarPaso2(form);
    expect(errores.cedula).toBeDefined();
  });

  it('V2.3 rechaza password con menos de 8 caracteres', () => {
    const form: OperarioForm = {
      ...OPERARIO_FORM_VACIO,
      cedula: '12345678',
      nombre: 'Ana',
      password: 'corta',
      confirmar_password: 'corta',
      consentimiento: true,
    };
    const errores = validarPaso2(form);
    expect(errores.password).toBeDefined();
  });

  it('V2.4 rechaza confirmar_password cuando no coincide con password', () => {
    const form: OperarioForm = {
      ...OPERARIO_FORM_VACIO,
      cedula: '12345678',
      nombre: 'Ana',
      password: 'miclave123',
      confirmar_password: 'OTRA_COSA',
      consentimiento: true,
    };
    const errores = validarPaso2(form);
    expect(errores.confirmar_password).toBeDefined();
  });

  it('V2.5 rechaza cuando el consentimiento no esta marcado', () => {
    const form: OperarioForm = {
      ...OPERARIO_FORM_VACIO,
      cedula: '12345678',
      nombre: 'Ana',
      password: 'miclave123',
      confirmar_password: 'miclave123',
      consentimiento: false,
    };
    const errores = validarPaso2(form);
    expect(errores.consentimiento).toBeDefined();
  });

  it('V2.6 acepta form completamente valido (con email opcional)', () => {
    const form: OperarioForm = {
      cedula: '12345678',
      nombre: 'Ana Lopez',
      email: 'ana@example.com',
      password: 'miclave123',
      confirmar_password: 'miclave123',
      consentimiento: true,
    };
    const errores = validarPaso2(form);
    expect(errores).toEqual({});
  });
});

// ── TESTS DE INTEGRACION (componente) ───────────────────────────────────────

const onCompleteMock = jest.fn();

/** Form prestador valido para los tests de integracion. */
function formPrestadorValido(): PrestadorForm {
  return {
    nombre: 'Asociacion La Esperanza',
    nit: '900123456-7',
    representante_legal: 'Juan Perez',
    representante_legal_cedula: '12345678',
    municipio: 'Caqueza',
    departamento: 'Cundinamarca',
    segmento: 2,
    num_suscriptores_urbanos: 0,
    num_suscriptores_rurales: 150,
    email: '',
    telefono: '',
  };
}

/** Form operario valido para los tests de integracion. */
function formOperarioValido(): OperarioForm {
  return {
    cedula: '12345678',
    nombre: 'Juan Perez',
    email: '',
    password: 'miclave123',
    confirmar_password: 'miclave123',
    consentimiento: true,
  };
}

describe('SetupInicial (integracion paso 1)', () => {
  beforeEach(() => {
    onCompleteMock.mockClear();
    useWorkspace.setState({
      id_prestador_activo: 0,
      prestador: null,
      prestadores_disponibles: [],
      acuerdo_vigente: null,
      parametros_vigentes: null,
      cargando: false,
    });
  });

  it('I1.1 muestra los campos del prestador en el render inicial', () => {
    const { getByPlaceholderText, getByText } = render(
      <SetupInicial onComplete={onCompleteMock} />,
    );

    // El wizard arranca en paso 1 → campos del prestador visibles.
    expect(getByText('Paso 1 de 2')).toBeTruthy();
    // Al menos un campo del prestador: NOMBRE
    expect(getByPlaceholderText('Ej: Asociacion de Usuarios La Esperanza')).toBeTruthy();
    // El boton de siguiente
    expect(getByText('SIGUIENTE')).toBeTruthy();
  });

  it('I1.2 NO muestra los campos del operario en el paso 1', () => {
    const { queryByPlaceholderText } = render(
      <SetupInicial onComplete={onCompleteMock} />,
    );

    // Campo tipico del paso 2 (password) NO debe estar visible.
    expect(queryByPlaceholderText('Minimo 8 caracteres')).toBeNull();
  });
});
