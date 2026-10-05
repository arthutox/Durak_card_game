import { describe, expect, it } from 'vitest';
import { isLoopback, isTrustedBoardOrigin } from './auth.js';

describe('isLoopback', () => {
  it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1'])('accepts %s', (address) => {
    expect(isLoopback(address)).toBe(true);
  });

  it.each(['192.168.1.20', '10.0.0.5', '::ffff:192.168.1.20', ''])('rejects %j', (address) => {
    expect(isLoopback(address)).toBe(false);
  });
});

describe('isTrustedBoardOrigin', () => {
  it.each([undefined, 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://[::1]:3000'])(
    'accepts %j',
    (origin) => {
      expect(isTrustedBoardOrigin(origin)).toBe(true);
    },
  );

  it.each([
    'https://evil.example',
    'http://192.168.0.189:5173',
    'http://localhost.evil.example',
    'http://evil.example/localhost',
    'null',
    '',
    'not a url',
  ])('rejects %j', (origin) => {
    expect(isTrustedBoardOrigin(origin)).toBe(false);
  });
});
