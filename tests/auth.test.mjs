import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, readCookie, randomToken, COOKIE } from '../worker/auth.js';

test('password hash round trip', async () => {
  const stored = await hashPassword('correct horse battery');
  assert.match(stored, /^pbkdf2\$100000\$/);
  assert.equal(await verifyPassword('correct horse battery', stored), true);
  assert.equal(await verifyPassword('wrong', stored), false);
  assert.equal(await verifyPassword('x', 'garbage'), false);
});

test('two hashes of the same password differ (salt)', async () => {
  assert.notEqual(await hashPassword('same'), await hashPassword('same'));
});

test('reads the session cookie among others', () => {
  const req = new Request('https://x/', { headers: { Cookie: `a=1; ${COOKIE}=abc=; b=2` } });
  assert.equal(readCookie(req), 'abc=');
  assert.equal(readCookie(new Request('https://x/')), null);
});

test('tokens are url-safe', () => {
  assert.match(randomToken(), /^[A-Za-z0-9_-]{43}$/);
});
