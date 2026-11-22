import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTokenService } from '../src/lib/tokens.js';
import { makeTestApp, TEST_SECRET } from './helpers/testApp.js';

const sofi = { nombre: 'Sofía', email: 'sofi@mail.com', password: 'secreta123' };

describe('POST /api/auth/register', () => {
  it('201 con token, y /me devuelve al mismo usuario (CA-01.1)', async () => {
    const { app } = makeTestApp();
    const reg = await request(app).post('/api/auth/register').send(sofi);
    expect(reg.status).toBe(201);
    expect(reg.body.usuario).toEqual({
      id: expect.any(String),
      nombre: 'Sofía',
      email: 'sofi@mail.com',
    });
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${reg.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body).toEqual({ usuario: reg.body.usuario });
  });

  it('normaliza el email: con espacios y mayúsculas es la misma cuenta', async () => {
    const { app } = makeTestApp();
    await request(app)
      .post('/api/auth/register')
      .send({ ...sofi, email: '  Sofi@Mail.com ' })
      .expect(201);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sofi@mail.com', password: sofi.password });
    expect(login.status).toBe(200);
  });

  it('email repetido en otra capitalización → 409 EMAIL_EN_USO (CA-01.2)', async () => {
    const { app } = makeTestApp();
    await request(app).post('/api/auth/register').send(sofi).expect(201);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...sofi, email: 'SOFI@MAIL.COM' });
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({ code: 'EMAIL_EN_USO', message: 'El email ya está en uso' });
  });

  it('contraseña corta o email inválido → 400 con detalle por campo (CA-01.3)', async () => {
    const { app } = makeTestApp();
    const corta = await request(app)
      .post('/api/auth/register')
      .send({ ...sofi, password: '1234567' });
    expect(corta.status).toBe(400);
    expect(corta.body.error.code).toBe('VALIDATION_ERROR');
    expect(corta.body.error.details.password).toMatch(/8 caracteres/);
    const mail = await request(app)
      .post('/api/auth/register')
      .send({ ...sofi, email: 'no-es-mail' });
    expect(mail.status).toBe(400);
    expect(mail.body.error.details.email).toBeDefined();
  });

  it('contraseña de 73 caracteres → 400', async () => {
    const { app } = makeTestApp();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...sofi, password: 'a'.repeat(73) });
    expect(res.status).toBe(400);
    expect(res.body.error.details.password).toMatch(/72/);
  });

  it('ninguna respuesta incluye el hash de la contraseña (CA-01.4)', async () => {
    const { app } = makeTestApp();
    const reg = await request(app).post('/api/auth/register').send(sofi);
    const login = await request(app).post('/api/auth/login').send(sofi);
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${reg.body.token}`);
    for (const r of [reg, login, me]) {
      expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|password_hash|\$2[aby]\$/);
    }
  });
});

describe('POST /api/auth/login', () => {
  it('credenciales incorrectas → 401 CREDENCIALES_INVALIDAS (CA-02.2)', async () => {
    const { app } = makeTestApp();
    await request(app).post('/api/auth/register').send(sofi);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: sofi.email, password: 'otra-clave' });
    expect(res.status).toBe(401);
    expect(res.body.error).toEqual({
      code: 'CREDENCIALES_INVALIDAS',
      message: 'Email o contraseña incorrectos',
    });
  });
});

describe('GET /api/auth/me', () => {
  it('sin token → 401 NO_AUTENTICADO (CA-05.2)', async () => {
    const { app } = makeTestApp();
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NO_AUTENTICADO');
  });

  it('token inválido → 401 TOKEN_INVALIDO', async () => {
    const { app } = makeTestApp();
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer basura');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALIDO');
  });

  it('token vencido → 401 TOKEN_EXPIRADO (CA-03.2)', async () => {
    const { app } = makeTestApp();
    const viejo = createTokenService({ secret: TEST_SECRET, expiresIn: '-1s' }).sign({
      sub: 'u1',
    });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${viejo}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRADO');
  });
});

describe('límite de intentos', () => {
  it('el intento 11 de login en la ventana → 429 DEMASIADOS_INTENTOS', async () => {
    const { app } = makeTestApp({ rateLimit: true });
    const intento = () =>
      request(app).post('/api/auth/login').send({ email: 'x@mail.com', password: 'nada1234' });
    for (let i = 0; i < 10; i++) await intento();
    const res = await intento();
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('DEMASIADOS_INTENTOS');
  });
});
