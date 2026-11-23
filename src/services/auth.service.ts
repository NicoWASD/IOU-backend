import type { Usuario, UsuarioRepository } from '../domain/usuario.js';
import { AppError } from '../lib/errors.js';
import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS, hashPassword, verifyPassword } from '../lib/password.js';
import type { TokenService } from '../lib/tokens.js';

export type AuthResult = { token: string; usuario: Usuario };

export type AuthService = {
  register(input: { nombre: string; email: string; password: string }): Promise<AuthResult>;
  login(input: { email: string; password: string }): Promise<AuthResult>;
  me(id: string): Promise<Usuario>;
};

// Hash de una contraseña descartable: se compara cuando el email no existe,
// así el tiempo de respuesta no revela qué emails están registrados.
const DUMMY_HASH = bcrypt.hashSync('contraseña-descartable', BCRYPT_ROUNDS);

const credencialesInvalidas = () =>
  new AppError(401, 'CREDENCIALES_INVALIDAS', 'Email o contraseña incorrectos');

/** Recibe datos ya validados y normalizados (email en minúsculas, sin espacios). */
export function createAuthService(deps: {
  usuarios: UsuarioRepository;
  tokens: TokenService;
}): AuthService {
  const { usuarios, tokens } = deps;
  const resultado = (usuario: Usuario): AuthResult => ({
    token: tokens.sign({ sub: usuario.id }),
    usuario,
  });

  return {
    async register({ nombre, email, password }) {
      const passwordHash = await hashPassword(password);
      const usuario = await usuarios.create({ nombre, email, passwordHash });
      return resultado(usuario);
    },

    async login({ email, password }) {
      const encontrado = await usuarios.findByEmail(email);
      const ok = await verifyPassword(password, encontrado?.passwordHash ?? DUMMY_HASH);
      if (!encontrado || !ok) throw credencialesInvalidas();
      const { id, nombre } = encontrado;
      return resultado({ id, nombre, email: encontrado.email });
    },

    async me(id) {
      const usuario = await usuarios.findById(id);
      if (!usuario) {
        throw new AppError(401, 'TOKEN_INVALIDO', 'La sesión no es válida. Ingresá de nuevo.');
      }
      return usuario;
    },
  };
}
