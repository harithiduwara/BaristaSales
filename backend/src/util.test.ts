import { describe, expect, it } from 'vitest';
import { b64uDecode, b64uEncode, bytesToHex, constantTimeEqual } from './util';

describe('util', () => {
  it.each(['', 'a', 'ab', 'abc', '{"role":"Owner"}', 'Rs ₨ 😀 é'])('base64url round-trips %s', (s) => {
    expect(b64uEncode(s)).toBe(Buffer.from(s, 'utf8').toString('base64url'));
    expect(b64uDecode(b64uEncode(s))).toBe(s);
  });
  it('rejects malformed base64url', () => {
    expect(b64uDecode('a+b/')).toBeNull();
    expect(b64uDecode('abcde')).toBeNull();
    expect(b64uDecode('_w')).toBeNull();
  });
  it('compares in constant time', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'ab')).toBe(false);
  });
  it('formats signed bytes as hex', () => expect(bytesToHex([0, 15, -1, 127, -128])).toBe('000fff7f80'));
});
