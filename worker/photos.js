// Wikimedia Commons photos, copied into R2 on first view so the site stays fast
// and does not depend on Commons being reachable.

const WIDTH = 800;
const USER_AGENT = 'citybook/0.1 (personal city guide; https://github.com/Victoire-gorge/citybook)';

export async function commonsPhoto(db, bucket, file, ctx) {
  // Only serve files that are actually referenced in the database: no open proxy.
  const known = await db.prepare("select 1 from photos where source = 'commons' and file = ?").bind(file).first();
  if (!known) return new Response('Not found', { status: 404 });

  const key = `commons/${WIDTH}/${file}`;
  const cached = await bucket.get(key);
  if (cached) return imageResponse(cached.body, cached.httpMetadata?.contentType);

  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${WIDTH}`;
  let upstream;
  try {
    upstream = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' });
  } catch {
    return new Response('Photo unavailable', { status: 502 });
  }
  if (!upstream.ok) return new Response('Photo unavailable', { status: 502 });
  const type = upstream.headers.get('Content-Type') || 'image/jpeg';
  const bytes = await upstream.arrayBuffer();
  ctx.waitUntil(bucket.put(key, bytes, { httpMetadata: { contentType: type } }));
  return imageResponse(bytes, type);
}

export function imageResponse(body, type = 'image/jpeg', cache = 'public, max-age=604800') {
  return new Response(body, { headers: { 'Content-Type': type, 'Cache-Control': cache } });
}
