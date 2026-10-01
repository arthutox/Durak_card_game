import { describe, expect, it } from 'vitest';
import { isLoopback } from './auth.js';

describe('isLoopback', () => {
  it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1'])('accepts %s', (address) => {
    expect(isLoopback(address)).toBe(true);
  });

  it.each(['192.168.1.20', '10.0.0.5', '::ffff:192.168.1.20', ''])('rejects %j', (address) => {
    expect(isLoopback(address)).toBe(false);
  });
});
