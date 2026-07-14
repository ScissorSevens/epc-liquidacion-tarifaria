/**
 * Helper `loginLocal()` — TICKET-EPIC-LOGIN-001 / PUNTO A.
 *
 * Valida localmente la cedula + password contra la DB SQLite del
 * dispositivo (sin backend). Devuelve una `Sesion` multi-tenant con
 * `idPrestador` REAL del operario si la validacion pasa.
 *
 * Diseño:
 *   - Funcion PURA sin side effects: no toca AsyncStorage, no muestra
 *     Alerts, no navega. La UI (Login.tsx) es responsable de mapear
 *     los throws a feedback al usuario.
 *   - Inyeccion de dependencias: recibe `operarioRepo` y `hasher` por
 *     parametro. El wrapper de UI los resuelve via `getBootstrap()`.
 *   - Errores tipados como Error con messages canonicos:
 *       - `OPERARIO_NO_ENCONTRADO`  → cedula no esta en la DB local.
 *       - `PASSWORD_INCORRECTA`    → hash de la password no coincide.
 *     La UI traduce estos codigos a mensajes user-friendly.
 *
 * Por que SHA-256 y no bcrypt/argon2:
 *   El bootstrapCompleto (Fase 5.1) ya usa `hasher.sha256()` para hashear
 *   el password del operario al crearlo. loginLocal DEBE usar el mismo
 *   algoritmo para que la comparacion sea consistente. Migrar a bcrypt
 *   es una deuda de seguridad para Fase 6+ (cuando llegue el backend real).
 *
 * Trade-off de seguridad documentado:
 *   Guardar el hash en SQLite local es un trade-off MVP (decision
 *   2026-07-09). En produccion (Fase 6) se reemplaza por un token
 *   de sesion opaco + autenticacion contra backend.
 */
import type { Hasher } from '../../dominio/shared/ports';
import type { OperarioRepositoryExpoSqlite } from '../persistencia/expo-sqlite/operario-repository-expo-sqlite';
import type { Operario } from '../operarios/types';
import type { Sesion } from './constantes';

/** Codigos de error canonicos del helper. La UI los traduce a mensajes. */
export const ERROR_OPERARIO_NO_ENCONTRADO = 'OPERARIO_NO_ENCONTRADO';
export const ERROR_PASSWORD_INCORRECTA = 'PASSWORD_INCORRECTA';

/** 24h en ms — la sesion local vence al dia siguiente del login. */
const MS_EN_UN_DIA = 24 * 60 * 60 * 1000;

export interface LoginLocalInput {
  readonly operarioRepo: OperarioRepositoryExpoSqlite;
  readonly hasher: Hasher;
  readonly cedula: string;
  readonly password: string;
}

export interface LoginLocalResultado {
  readonly sesion: Sesion;
  readonly operario: Operario;
}

/**
 * Valida cedula + password contra la DB local.
 *
 * @throws Error con `message === 'OPERARIO_NO_ENCONTRADO'` si la cedula
 *         no esta en la DB.
 * @throws Error con `message === 'PASSWORD_INCORRECTA'` si el hash SHA-256
 *         de la password no coincide con el `password_hash` del operario.
 *
 * El password NUNCA se compara en claro — se hashea con `hasher.sha256`
 * antes de comparar. Esto matchea el hasheo del `bootstrapCompleto` al
 * crear el operario.
 */
export async function loginLocal(deps: LoginLocalInput): Promise<LoginLocalResultado> {
  const cedulaLimpia = deps.cedula.trim();

  // 1. Buscar el operario por cedula.
  const operario = await deps.operarioRepo.buscarPorCedula(cedulaLimpia);
  if (operario === null) {
    throw new Error(ERROR_OPERARIO_NO_ENCONTRADO);
  }

  // 2. Validar la password hasheada.
  const passwordHash = deps.hasher.sha256(deps.password);
  if (operario.password_hash !== passwordHash) {
    throw new Error(ERROR_PASSWORD_INCORRECTA);
  }

  // 3. Construir la sesion con idPrestador REAL del operario.
  //    El token es placeholder hasta que llegue el backend (Fase 6).
  const sesion: Sesion = {
    token: `fake-token-${Date.now()}`,
    cedula: operario.numero_cedula,
    nombre: operario.nombre,
    idPrestador: operario.id_prestador,
    expiresAt: Date.now() + MS_EN_UN_DIA,
  };

  return { sesion, operario };
}