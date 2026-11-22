import request from 'supertest';
import { expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const ok = createApp({ checkDb: async () => {}, corsOrigins: ['http://localhost:5173'] });
const down = createApp({
  checkDb: async () => {
    throw new Error('ECONNREFUSED');
  },
  corsOrigins: [],
});

it('GET /api/health → 200 con DB ok', async () => {
  const res = await request(ok).get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: 'ok', db: 'ok' });
});

it('GET /api/health → 503 si la DB falla, sin filtrar el error', async () => {
  const res = await request(down).get('/api/health');
  expect(res.status).toBe(503);
  expect(res.body).toEqual({ status: 'error', db: 'error' });
});
