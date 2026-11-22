import { beforeEach, describe, expect, it } from 'vitest';
import { createAuthService } from '../src/services/auth.service.js';
import { createTokenService } from '../src/lib/tokens.js';
import { createMemoryUsuarioRepository } from './helpers/memoryUsuarios.js';

const tokens = createTokenService({ secret: 'x'.repeat(32), expiresIn: '1h' });
let usuarios: ReturnType<typeof createMemoryUsuarioRepository>;
let auth: ReturnType<typeof createAuthService>;

beforeEach(() => {
  usuarios = createMemoryUsuarioRepository();
  auth = createAuthService({ usuarios, tokens });
});

const sofi = { nombre: 'Sofía', email: 'sofi@mail.com', password: 'secreta123' };

describe('register', () => {
  it('crea el usuario y devuelve un token suyo, sin el hash (CA-01.1, CA-01.4)', async () => {
    const res = await auth.register(sofi);
    expect(res.usuario).toEqual({
      id: expect.any(String),
      nombre: 'Sofía',
      email: 'sofi@mail.com',
    });
    expect(res.usuario).not.toHaveProperty('passwordHash');
    expect(tokens.verify(res.token).sub).toBe(res.usuario.id);
    expect(usuarios.all()[0]?.passwordHash).not.toBe('secreta123');
  });

  it('email repetido → EMAIL_EN_USO y no crea otro (CA-01.2)', async () => {
    await auth.register(sofi);
    await expect(auth.register(sofi)).rejects.toMatchObject({ status: 409, code: 'EMAIL_EN_USO' });
    expect(usuarios.all()).toHaveLength(1);
  });
});

describe('login', () => {
  beforeEach(async () => {
    await auth.register(sofi);
  });

  it('credenciales correctas → token (CA-02.1)', async () => {
    const res = await auth.login({ email: sofi.email, password: sofi.password });
    expect(tokens.verify(res.token).sub).toBe(res.usuario.id);
  });

  it('contraseña incorrecta y email inexistente → mismo error (CA-02.2)', async () => {
    const esperado = {
      status: 401,
      code: 'CREDENCIALES_INVALIDAS',
      message: 'Email o contraseña incorrectos',
    };
    await expect(auth.login({ email: sofi.email, password: 'otra-clave' })).rejects.toMatchObject(
      esperado,
    );
    await expect(
      auth.login({ email: 'nadie@mail.com', password: 'secreta123' }),
    ).rejects.toMatchObject(esperado);
  });
});

describe('me', () => {
  it('devuelve el usuario', async () => {
    const { usuario } = await auth.register(sofi);
    expect(await auth.me(usuario.id)).toEqual(usuario);
  });

  it('id inexistente → TOKEN_INVALIDO', async () => {
    await expect(auth.me('00000000-0000-0000-0000-000000000000')).rejects.toMatchObject({
      status: 401,
      code: 'TOKEN_INVALIDO',
    });
  });
});
