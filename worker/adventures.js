import { HttpError, pick, text, isDate, isTime, optional } from './http.js';
import { randomToken } from './auth.js';
import { photoView, getMap } from './places.js';

const PALETTES = ['blue-yellow', 'green-yellow', 'red-green', 'blue-orange'];
const LANGUAGES = ['en', 'fr'];
const MAX_COVER_BYTES = 8 * 1024 * 1024;
const COVER_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const ADVENTURE_RULES = {
  title: (v) => text(120)(v) && v.trim().length > 0,
  subtitle: text(200),
  starts_on: isDate,
  ends_on: isDate,
  party_size: (v) => Number.isInteger(v) && v >= 1 && v <= 50,
  guests: (v) => Array.isArray(v) && v.length <= 50 && v.every(text(80)),
  language: (v) => LANGUAGES.includes(v),
  palette: (v) => PALETTES.includes(v),
  notes: text(4000),
};

function view(a) {
  return {
    id: a.id,
    title: a.title,
    subtitle: a.subtitle,
    starts_on: a.starts_on,
    ends_on: a.ends_on,
    party_size: a.party_size,
    guests: JSON.parse(a.guests || '[]'),
    language: a.language,
    palette: a.palette,
    notes: a.notes,
    cover: a.cover_key ? `/media/${a.cover_key}` : null,
    shared: Boolean(a.share_token),
    share_token: a.share_token ?? undefined,
    city_id: a.city_id,
  };
}

async function own(db, userId, id) {
  const a = await db.prepare('select * from adventures where id = ? and owner_id = ?').bind(id, userId).first();
  if (!a) throw new HttpError(404, 'Unknown adventure');
  return a;
}

export async function listAdventures(db, userId) {
  const { results } = await db
    .prepare(
      `select a.*, (select count(*) from adventure_items i where i.adventure_id = a.id) as item_count,
              (select count(distinct place_id) from adventure_items i where i.adventure_id = a.id) as place_count
       from adventures a where owner_id = ? order by starts_on desc`,
    )
    .bind(userId)
    .all();
  return results.map((a) => ({ ...view(a), item_count: a.item_count, place_count: a.place_count }));
}

export async function createAdventure(db, userId, body) {
  const f = pick(body, ADVENTURE_RULES);
  if (!f.title || !f.starts_on || !f.ends_on) throw new HttpError(400, 'Title and dates are required');
  if (f.ends_on < f.starts_on) throw new HttpError(400, 'The adventure ends before it starts');
  const id = randomToken(9);
  await db
    .prepare(
      `insert into adventures (id, owner_id, city_id, title, subtitle, starts_on, ends_on, party_size, guests, language, palette, notes)
       values (?, ?, 'paris', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id, userId, f.title.trim(), f.subtitle ?? '', f.starts_on, f.ends_on, f.party_size ?? 1,
      JSON.stringify(f.guests ?? []), f.language ?? 'en', f.palette ?? 'blue-yellow', f.notes ?? '',
    )
    .run();
  return getAdventure(db, userId, id);
}

export async function updateAdventure(db, userId, id, body) {
  const current = await own(db, userId, id);
  const f = pick(body, ADVENTURE_RULES);
  const starts = f.starts_on ?? current.starts_on;
  const ends = f.ends_on ?? current.ends_on;
  if (ends < starts) throw new HttpError(400, 'The adventure ends before it starts');
  if ('guests' in f) f.guests = JSON.stringify(f.guests);
  if ('title' in f) f.title = f.title.trim();
  const keys = Object.keys(f);
  if (keys.length) {
    await db
      .prepare(
        `update adventures set ${keys.map((k) => `${k} = ?`).join(', ')},
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') where id = ?`,
      )
      .bind(...Object.values(f), id)
      .run();
  }
  return getAdventure(db, userId, id);
}

export async function deleteAdventure(db, bucket, userId, id) {
  const a = await own(db, userId, id);
  await db.prepare('delete from adventures where id = ?').bind(id).run();
  if (a.cover_key) await bucket.delete(a.cover_key);
}

async function items(db, adventureId) {
  const { results } = await db
    .prepare(
      `select i.*, p.name as place_name, p.summary as place_summary, p.price as place_price, p.website as place_website, p.layer_id, p.lat, p.lng,
              e.title as event_title, e.url as event_url,
              ph.id as photo_id, ph.source as photo_source, ph.file as photo_file,
              ph.author as photo_author, ph.license as photo_license, ph.source_url as photo_source_url
       from adventure_items i
       left join places p on p.id = i.place_id
       left join events e on e.id = i.event_id
       left join photos ph on ph.id = (select id from photos where place_id = i.place_id order by sort limit 1)
       where i.adventure_id = ? order by i.day is null, i.day, i.sort`,
    )
    .bind(adventureId)
    .all();
  return results.map((i) => ({
    id: i.id,
    day: i.day,
    start_time: i.start_time,
    end_time: i.end_time,
    title: i.title || i.place_name || i.event_title || '',
    note: i.note,
    done: Boolean(i.done),
    place_id: i.place_id,
    layer_id: i.layer_id,
    lat: i.lat,
    lng: i.lng,
    event_id: i.event_id,
    url: i.event_url,
    summary: i.place_summary || '',
    price: i.place_price || '',
    website: i.place_website || null,
    photo: i.photo_id
      ? photoView({ id: i.photo_id, source: i.photo_source, file: i.photo_file, author: i.photo_author,
          license: i.photo_license, source_url: i.photo_source_url })
      : null,
  }));
}

async function days(db, adventureId) {
  const { results } = await db
    .prepare('select day, theme from adventure_days where adventure_id = ?')
    .bind(adventureId)
    .all();
  return Object.fromEntries(results.map((d) => [d.day, d.theme]));
}

/** Title of one day of the adventure ("First steps in Paris"). Empty text removes it. */
export async function setDayTheme(db, userId, adventureId, day, body) {
  const a = await own(db, userId, adventureId);
  if (!isDate(day) || day < a.starts_on || day > a.ends_on) throw new HttpError(400, 'This day is outside the adventure');
  const { theme } = pick(body, { theme: text(120) });
  if (theme === undefined) throw new HttpError(400, 'Nothing to update');
  if (theme.trim()) {
    await db
      .prepare(`insert into adventure_days (adventure_id, day, theme) values (?, ?, ?)
                on conflict (adventure_id, day) do update set theme = excluded.theme`)
      .bind(adventureId, day, theme.trim())
      .run();
  } else {
    await db.prepare('delete from adventure_days where adventure_id = ? and day = ?').bind(adventureId, day).run();
  }
}

/** New order of the items of one day (or of the ideas when day is null). */
export async function reorderItems(db, userId, adventureId, body) {
  await own(db, userId, adventureId);
  const ids = body?.ids;
  if (!Array.isArray(ids) || ids.length > 200 || !ids.every((x) => typeof x === 'string')) {
    throw new HttpError(400, 'ids must be a list of item ids');
  }
  if (ids.length === 0) return;
  await db.batch(
    ids.map((id, i) =>
      db.prepare('update adventure_items set sort = ? where id = ? and adventure_id = ?').bind(i + 1, id, adventureId),
    ),
  );
}

export async function getAdventure(db, userId, id) {
  const a = await own(db, userId, id);
  return { ...view(a), days: await days(db, id), items: await items(db, id) };
}

/**
 * The owner's whole city map, for people holding an adventure's share link,
 * with the places already saved in that adventure (and on which day).
 */
export async function getSharedMap(db, token, today) {
  if (!token || token.length < 16) throw new HttpError(404, 'Unknown link');
  const a = await db
    .prepare(
      `select a.id, a.title, a.city_id, a.starts_on, a.ends_on, a.language, u.name as owner_name
       from adventures a join users u on u.id = a.owner_id where a.share_token = ?`,
    )
    .bind(token)
    .first();
  if (!a) throw new HttpError(404, 'Unknown link');
  const [map, saved] = await Promise.all([
    getMap(db, a.city_id, today),
    db.prepare(
      `select place_id, day from adventure_items
       where adventure_id = ? and place_id is not null order by day is null, day, sort`,
    ).bind(a.id).all(),
  ]);
  return {
    ...map,
    adventure: { title: a.title, starts_on: a.starts_on, ends_on: a.ends_on, language: a.language, owner: a.owner_name },
    saved: saved.results,
  };
}

/** Read-only view for people with the share link. No owner data, no token echo. */
export async function getSharedAdventure(db, token) {
  if (!token || token.length < 16) throw new HttpError(404, 'Unknown link');
  const a = await db.prepare('select * from adventures where share_token = ?').bind(token).first();
  if (!a) throw new HttpError(404, 'Unknown link');
  const { share_token, shared, ...publicView } = view(a);
  return {
    ...publicView,
    cover: a.cover_key ? `/media/${a.cover_key}?share=${token}` : null,
    days: await days(db, a.id),
    items: await items(db, a.id),
  };
}

const ITEM_RULES = {
  day: optional(isDate),
  start_time: optional(isTime),
  end_time: optional(isTime),
  place_id: optional(text(80)),
  event_id: optional(text(80)),
  title: text(200),
  note: text(1000),
  done: (v) => typeof v === 'boolean',
};

export async function addItem(db, userId, adventureId, body) {
  const a = await own(db, userId, adventureId);
  const f = pick(body, ITEM_RULES);
  if (!f.place_id && !f.event_id && !f.title?.trim()) throw new HttpError(400, 'An item needs a place, an event or a title');
  if (f.day && (f.day < a.starts_on || f.day > a.ends_on)) throw new HttpError(400, 'This day is outside the adventure');
  const id = randomToken(9);
  await db
    .prepare(
      `insert into adventure_items (id, adventure_id, day, start_time, end_time, place_id, event_id, title, note, sort)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, (select coalesce(max(sort), 0) + 1 from adventure_items where adventure_id = ?))`,
    )
    .bind(
      id, adventureId, f.day ?? null, f.start_time ?? null, f.end_time ?? null, f.place_id ?? null,
      f.event_id ?? null, f.title ?? '', f.note ?? '', adventureId,
    )
    .run();
  return id;
}

export async function updateItem(db, userId, adventureId, itemId, body) {
  const a = await own(db, userId, adventureId);
  const f = pick(body, ITEM_RULES);
  if (f.day && (f.day < a.starts_on || f.day > a.ends_on)) throw new HttpError(400, 'This day is outside the adventure');
  const keys = Object.keys(f);
  if (!keys.length) throw new HttpError(400, 'Nothing to update');
  // An item moved to another day goes to the end of that day.
  const moveToEnd = 'day' in f ? ', sort = (select coalesce(max(sort), 0) + 1 from adventure_items where adventure_id = ?)' : '';
  const res = await db
    .prepare(`update adventure_items set ${keys.map((k) => `${k} = ?`).join(', ')}${moveToEnd} where id = ? and adventure_id = ?`)
    .bind(...Object.values(f).map((v) => (typeof v === 'boolean' ? Number(v) : v)), ...(moveToEnd ? [adventureId] : []), itemId, adventureId)
    .run();
  if (!res.meta.changes) throw new HttpError(404, 'Unknown item');
}

export async function deleteItem(db, userId, adventureId, itemId) {
  await own(db, userId, adventureId);
  await db.prepare('delete from adventure_items where id = ? and adventure_id = ?').bind(itemId, adventureId).run();
}

export async function setShare(db, userId, id, enabled) {
  await own(db, userId, id);
  const token = enabled ? randomToken(18) : null;
  await db.prepare('update adventures set share_token = ? where id = ?').bind(token, id).run();
  return token;
}

/** Real type of an image from its first bytes, so a file cannot pretend to be a photo. */
export function sniffImage(b) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  const ascii = (from, to) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/** Stores a new cover photo in R2 (private) and removes the old one. */
export async function setCover(db, bucket, userId, id, request) {
  const a = await own(db, userId, id);
  const type = (request.headers.get('Content-Type') || '').split(';')[0];
  const ext = COVER_TYPES[type];
  if (!ext) throw new HttpError(415, 'Use a JPEG, PNG or WebP image');
  const body = await request.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > MAX_COVER_BYTES) throw new HttpError(413, 'Image must be under 8 MB');
  if (sniffImage(new Uint8Array(body, 0, Math.min(12, body.byteLength))) !== type) {
    throw new HttpError(415, 'Use a JPEG, PNG or WebP image');
  }
  const key = `covers/${id}-${randomToken(6)}.${ext}`;
  await bucket.put(key, body, { httpMetadata: { contentType: type } });
  await db.prepare('update adventures set cover_key = ? where id = ?').bind(key, id).run();
  if (a.cover_key) await bucket.delete(a.cover_key);
  return `/media/${key}`;
}

/** Who may see a private media file: its owner, or someone holding the adventure's share link. */
export async function canSeeCover(db, key, user, shareToken) {
  const a = await db.prepare('select owner_id, share_token from adventures where cover_key = ?').bind(key).first();
  if (!a) return false;
  if (user && user.id === a.owner_id) return true;
  return Boolean(shareToken && a.share_token && shareToken === a.share_token);
}
