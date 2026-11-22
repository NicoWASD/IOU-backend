import request from 'supertest';
import { expect, it } from 'vitest';
import { makeTestApp } from './helpers/testApp.js';

const { app: ok } = makeTestApp();

it('ruta inexistente → 404 con formato de error', async () => {
  const res = await request(ok).get('/api/nada');
  expect(res.status).toBe(404);
  expect(res.body).toEqual({
    error: { code: 'NOT_FOUND', message: 'Ruta no encontrada: GET /api/nada' },
  });
});

it('JSON mal formado → 400 INVALID_JSON', async () => {
  const res = await request(ok)
    .post('/api/health')
    .set('Content-Type', 'application/json')
    .send('{"a":');
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('INVALID_JSON');
});

it('CORS permite el origen configurado', async () => {
  const res = await request(ok).get('/api/health').set('Origin', 'http://localhost:5173');
  expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
});

it('CORS no permite otros orígenes', async () => {
  const res = await request(ok).get('/api/health').set('Origin', 'https://malicioso.com');
  expect(res.headers['access-control-allow-origin']).toBeUndefined();
});
