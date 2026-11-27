import bcrypt from 'bcryptjs';
import { nombreVisible, type Usuario, type UsuarioRepository } from '../domain/usuario.js';
import { AppError } from '../lib/errors.js';
import { BCRYPT_ROUNDS, hashPassword, verifyPassword } from '../lib/password.js';
import type { TokenService } from '../lib/tokens.js';

export type AuthResult = { token: string; usuario: Usuario };

export type CambiosPerfilInput = {
  usuario?: string;
  nombre?: string | null;
  apellido?: string | null;
  tutorialVisto?: boolean;
};

export type AuthService = {
  register(input: { usuario: string; email: string; password: string }): Promise<AuthResult>;
  login(input: { email: string; password: string }): Promise<AuthResult>;
  me(id: string): Promise<Usuario>;
  /** HU-34: edita el perfil y recalcula el nombre visible (RN-19). */
  actualizarPerfil(id: string, cambios: CambiosPerfilInput): Promise<Usuario>;
};

// Hash de una contraseña descartable: se compara cuando el email no existe,
// así el tiempo de respuesta no revela qué emails están registrados.
const DUMMY_HASH = bcrypt.hashSync('contraseña-descartable', BCRYPT_ROUNDS);

const credencialesInvalidas = () =>
  new AppError(401, 'CREDENCIALES_INVALIDAS', 'Email o contraseña incorrectos');

/** Recibe datos ya validados y normalizados (email y usuario en minúsculas, sin espacios). */
export function createAuthService(deps: {
  usuarios: UsuarioRepository;
  tokens: TokenService;
}): AuthService {
  const { usuarios, tokens } = deps;
  const resultado = (usuario: Usuario): AuthResult => ({
    token: tokens.sign({ sub: usuario.id }),
    usuario,
  });
  const me = async (id: string) => {
    const usuario = await usuarios.findById(id);
    if (!usuario) {
      throw new AppError(401, 'TOKEN_INVALIDO', 'La sesión no es válida. Ingresá de nuevo.');
    }
    return usuario;
  };

  return {
    async register({ usuario, email, password }) {
      const passwordHash = await hashPassword(password);
      return resultado(await usuarios.create({ nombre: usuario, usuario, email, passwordHash }));
    },

    async login({ email, password }) {
      const encontrado = await usuarios.findByEmail(email);
      const ok = await verifyPassword(password, encontrado?.passwordHash ?? DUMMY_HASH);
      if (!encontrado || !ok) throw credencialesInvalidas();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- se descarta el hash
      const { passwordHash, ...usuario } = encontrado;
      return resultado(usuario);
    },

    me,

    async actualizarPerfil(id, { nombre, ...cambios }) {
      const actual = await me(id);
      const d = { ...cambios, ...(nombre !== undefined && { nombreReal: nombre }) };
      const final = {
        ...actual,
        ...Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)),
      };
      return usuarios.actualizar(id, { ...d, nombre: nombreVisible(final) });
    },
  };
}
