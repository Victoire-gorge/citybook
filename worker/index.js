// citybook Worker: JSON API, photos and private media. Pages are static assets built by Vite.

import { json, readJson, HttpError } from './http.js';
import {
  verifyPassword, createSession, currentUser, deleteSession, sessionCookie,
} from './auth.js';
import { getMap, updatePlace } from './places.js';
import {
  listAdventures, createAdventure, getAdventure, updateAdventure, deleteAdventure,
  addItem, updateItem, deleteItem, setShare, setDayTheme, reorderItems, setCover, getSharedAdventure, getSharedMap, canSeeCover,
} from './adventures.js';
import { commonsPhoto, imageResponse } from './photos.js';

/** Today's date in Paris, 'YYYY-MM-DD'. */
export const parisToday = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(now);

// [method, pattern, handler, needsUser]
const routes = [
  ['POST', /^\/api\/login$/, login, false],
  ['POST', /^\/api\/logout$/, logout, false],
  ['GET', /^\/api\/me$/, async ({ user }) => json({ user }), true],
  ['GET', /^\/api\/map\/([\w-]+)$/, async ({ env, m }) => json(await getMap(env.DB, m[1], parisToday())), true],
  ['PATCH', /^\/api\/places\/([\w-]+)$/, async ({ env, m, request }) => {
    await updatePlace(env.DB, m[1], await readJson(request));
    return json({ ok: true });
  }, true],
  ['GET', /^\/api\/adventures$/, async ({ env, user }) => json(await listAdventures(env.DB, user.id)), true],
  ['POST', /^\/api\/adventures$/, async ({ env, user, request }) =>
    json(await createAdventure(env.DB, user.id, await readJson(request)), { status: 201 }), true],
  ['GET', /^\/api\/adventures\/([\w-]+)$/, async ({ env, user, m }) => json(await getAdventure(env.DB, user.id, m[1])), true],
  ['PATCH', /^\/api\/adventures\/([\w-]+)$/, async ({ env, user, m, request }) =>
    json(await updateAdventure(env.DB, user.id, m[1], await readJson(request))), true],
  ['DELETE', /^\/api\/adventures\/([\w-]+)$/, async ({ env, user, m }) => {
    await deleteAdventure(env.DB, env.PHOTOS, user.id, m[1]);
    return json({ ok: true });
  }, true],
  ['PUT', /^\/api\/adventures\/([\w-]+)\/cover$/, async ({ env, user, m, request }) =>
    json({ cover: await setCover(env.DB, env.PHOTOS, user.id, m[1], request) }), true],
  ['POST', /^\/api\/adventures\/([\w-]+)\/share$/, async ({ env, user, m, request }) => {
    const { enabled } = await readJson(request);
    return json({ share_token: await setShare(env.DB, user.id, m[1], Boolean(enabled)) });
  }, true],
  ['POST', /^\/api\/adventures\/([\w-]+)\/items$/, async ({ env, user, m, request }) =>
    json({ id: await addItem(env.DB, user.id, m[1], await readJson(request)) }, { status: 201 }), true],
  ['PATCH', /^\/api\/adventures\/([\w-]+)\/items\/([\w-]+)$/, async ({ env, user, m, request }) => {
    await updateItem(env.DB, user.id, m[1], m[2], await readJson(request));
    return json({ ok: true });
  }, true],
  ['DELETE', /^\/api\/adventures\/([\w-]+)\/items\/([\w-]+)$/, async ({ env, user, m }) => {
    await deleteItem(env.DB, user.id, m[1], m[2]);
    return json({ ok: true });
  }, true],
  ['PUT', /^\/api\/adventures\/([\w-]+)\/days\/(\d{4}-\d{2}-\d{2})$/, async ({ env, user, m, request }) => {
    await setDayTheme(env.DB, user.id, m[1], m[2], await readJson(request));
    return json({ ok: true });
  }, true],
  ['PUT', /^\/api\/adventures\/([\w-]+)\/order$/, async ({ env, user, m, request }) => {
    await reorderItems(env.DB, user.id, m[1], await readJson(request));
    return json({ ok: true });
  }, true],
  ['GET', /^\/api\/share\/([\w-]+)\/map$/, async ({ env, m }) => json(await getSharedMap(env.DB, m[1], parisToday())), false],
  ['GET', /^\/api\/share\/([\w-]+)$/, async ({ env, m }) => json(await getSharedAdventure(env.DB, m[1])), false],
  ['GET', /^\/photos\/commons\/(.+)$/, async ({ env, m, ctx }) =>
    commonsPhoto(env.DB, env.PHOTOS, decodeURIComponent(m[1]), ctx), false],
  ['GET', /^\/media\/(covers\/[\w.-]+)$/, media, false],
];

async function login({ env, request }) {
  const { email, password } = await readJson(request);
  if (typeof email !== 'string' || typeof password !== 'string') throw new HttpError(400, 'Email and password required');
  const user = await env.DB.prepare('select id, password_hash from users where email = ?')
    .bind(email.trim().toLowerCase())
    .first();
  // Same message whether the email or the password is wrong.
  if (!user || !(await verifyPassword(password, user.password_hash))) throw new HttpError(401, 'Wrong email or password');
  const token = await createSession(env.DB, user.id);
  return json({ ok: true }, { headers: { 'Set-Cookie': sessionCookie(token) } });
}

async function logout({ env, request }) {
  await deleteSession(env.DB, request);
  return json({ ok: true }, { headers: { 'Set-Cookie': sessionCookie('', 0) } });
}

async function media({ env, request, m, url }) {
  const key = m[1];
  const user = await currentUser(env.DB, request);
  if (!(await canSeeCover(env.DB, key, user, url.searchParams.get('share')))) {
    return new Response('Not found', { status: 404 });
  }
  const obj = await env.PHOTOS.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  return imageResponse(obj.body, obj.httpMetadata?.contentType, 'private, max-age=86400');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    for (const [method, pattern, handler, needsUser] of routes) {
      const m = url.pathname.match(pattern);
      if (!m || request.method !== method) continue;
      try {
        // Refuse cross-site writes: browsers always send Origin on POST/PATCH/PUT/DELETE.
        if (method !== 'GET') {
          const origin = request.headers.get('Origin');
          if (origin && origin !== url.origin) throw new HttpError(403, 'Cross-site request refused');
        }
        let user = null;
        if (needsUser) {
          user = await currentUser(env.DB, request);
          if (!user) throw new HttpError(401, 'Please sign in');
        }
        return await handler({ request, env, ctx, url, m, user });
      } catch (err) {
        if (err instanceof HttpError) return json({ error: err.message }, { status: err.status });
        console.error(err);
        return json({ error: 'Something went wrong' }, { status: 500 });
      }
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
