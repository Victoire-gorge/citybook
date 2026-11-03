// Small helpers for JSON responses and request bodies.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...init.headers },
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
export const isTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** Keeps only allowed keys, checks each with its validator, throws 400 on a bad value. */
export function pick(body, rules) {
  const out = {};
  for (const [key, check] of Object.entries(rules)) {
    if (!(key in body)) continue;
    const value = body[key];
    if (!check(value)) throw new HttpError(400, `Invalid value for ${key}`);
    out[key] = value;
  }
  return out;
}

export const text = (max) => (v) => typeof v === 'string' && v.length <= max;
export const optional = (check) => (v) => v === null || check(v);
