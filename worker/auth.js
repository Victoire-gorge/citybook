// Passwords and sessions. Works in the Worker and in Node (both have Web Crypto).

const ITERATIONS = 100_000; // the maximum PBKDF2 iteration count allowed in Workers
const SESSION_DAYS = 30;
export const COOKIE = 'citybook_session';

const enc = new TextEncoder();
const toB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, iterations, salt, expected] = String(stored).split('$');
  if (scheme !== 'pbkdf2') return false;
  const hash = new Uint8Array(await pbkdf2(password, fromB64(salt), Number(iterations)));
  const want = fromB64(expected);
  if (hash.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash[i] ^ want[i]; // constant-time compare
  return diff === 0;
}

export function randomToken(bytes = 32) {
  return toB64(crypto.getRandomValues(new Uint8Array(bytes))).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]);
}

export async function sha256(text) {
  return toB64(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

export function readCookie(request, name = COOKIE) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

export function sessionCookie(token, maxAgeSeconds = SESSION_DAYS * 86400) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

/** Creates a session row and returns the cookie token (only its hash is stored). */
export async function createSession(db, userId, now = new Date()) {
  const token = randomToken();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400 * 1000).toISOString();
  await db
    .prepare('insert into sessions (id, user_id, expires_at) values (?, ?, ?)')
    .bind(await sha256(token), userId, expires)
    .run();
  return token;
}

/** The signed-in user for this request, or null. */
export async function currentUser(db, request, now = new Date()) {
  const token = readCookie(request);
  if (!token) return null;
  return db
    .prepare(
      `select u.id, u.email, u.name from sessions s join users u on u.id = s.user_id
       where s.id = ? and s.expires_at > ?`,
    )
    .bind(await sha256(token), now.toISOString())
    .first();
}

export async function deleteSession(db, request) {
  const token = readCookie(request);
  if (token) await db.prepare('delete from sessions where id = ?').bind(await sha256(token)).run();
}
