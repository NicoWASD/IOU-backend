import { expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/lib/password.js';

it('el hash no contiene la contraseña y la verifica', async () => {
  const hash = await hashPassword('secreta123');
  expect(hash).not.toContain('secreta123');
  expect(await verifyPassword('secreta123', hash)).toBe(true);
  expect(await verifyPassword('otra-clave', hash)).toBe(false);
});
