import { describe, expect, it } from 'vitest';
import { createTokenService } from '../src/lib/tokens.js';

const secret = 'x'.repeat(32);
const tokens = createTokenService({ secret, expiresIn: '1h' });

describe('createTokenService', () => {
  it('firma y verifica', () => {
    expect(tokens.verify(tokens.sign({ sub: 'u1' })).sub).toBe('u1');
  });

  it('token vencido → TOKEN_EXPIRADO', () => {
    const viejo = createTokenService({ secret, expiresIn: '-1s' }).sign({ sub: 'u1' });
    expect(() => tokens.verify(viejo)).toThrow(
      expect.objectContaining({ status: 401, code: 'TOKEN_EXPIRADO' }),
    );
  });

  it('firma de otro secreto → TOKEN_INVALIDO', () => {
    const ajeno = createTokenService({ secret: 'y'.repeat(32), expiresIn: '1h' }).sign({
      sub: 'u1',
    });
    expect(() => tokens.verify(ajeno)).toThrow(
      expect.objectContaining({ status: 401, code: 'TOKEN_INVALIDO' }),
    );
  });

  it('basura → TOKEN_INVALIDO', () => {
    expect(() => tokens.verify('no-es-un-jwt')).toThrow(
      expect.objectContaining({ code: 'TOKEN_INVALIDO' }),
    );
  });
});
