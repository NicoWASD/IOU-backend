import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/app',
  CORS_ORIGIN: 'http://localhost:5173',
};

describe('loadEnv', () => {
  it('aplica defaults', () => {
    expect(loadEnv(base)).toMatchObject({ PORT: 3000, NODE_ENV: 'development' });
  });

  it('normaliza CORS_ORIGIN con espacios y barra final', () => {
    const env = loadEnv({
      ...base,
      CORS_ORIGIN: ' https://iou-client.vercel.app/ , http://localhost:5173',
    });
    expect(env.CORS_ORIGIN).toEqual(['https://iou-client.vercel.app', 'http://localhost:5173']);
  });

  it('nombra la variable que falta', () => {
    expect(() => loadEnv({ CORS_ORIGIN: 'x' })).toThrow(/DATABASE_URL/);
  });

  it('rechaza PORT no numérico', () => {
    expect(() => loadEnv({ ...base, PORT: 'abc' })).toThrow(/PORT/);
  });
});
