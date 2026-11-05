import { HttpError, pick, text, optional } from './http.js';

const parseJson = (s, fallback) => {
  try {
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
};

/** Everything the map needs for one city, in a single round trip of queries. */
export async function getMap(db, cityId, today) {
  const city = await db.prepare('select * from cities where id = ?').bind(cityId).first();
  if (!city) throw new HttpError(404, 'Unknown city');

  const [layers, places, hours, photos, events, areas] = await db.batch([
    db.prepare('select * from layers where city_id = ? order by sort').bind(cityId),
    db
      .prepare('select p.* from places p join layers l on l.id = p.layer_id where l.city_id = ? order by p.name')
      .bind(cityId),
    db
      .prepare(
        `select h.* from opening_hours h join places p on p.id = h.place_id
         join layers l on l.id = p.layer_id where l.city_id = ?`,
      )
      .bind(cityId),
    db
      .prepare(
        `select ph.* from photos ph join places p on p.id = ph.place_id
         join layers l on l.id = p.layer_id where l.city_id = ? order by ph.sort`,
      )
      .bind(cityId),
    db
      .prepare(
        `select e.* from events e left join places p on p.id = e.place_id left join layers l on l.id = p.layer_id
         where (e.place_id is null or l.city_id = ?) and (e.ends_on is null or e.ends_on >= ?)
         order by e.starts_on is null, e.starts_on, e.ends_on`,
      )
      .bind(cityId, today),
    db.prepare('select * from areas where city_id = ? order by sort, name').bind(cityId),
  ]);

  const byPlace = (rows) => {
    const m = new Map();
    for (const r of rows.results) {
      if (!m.has(r.place_id)) m.set(r.place_id, []);
      m.get(r.place_id).push(r);
    }
    return m;
  };
  const hoursBy = byPlace(hours);
  const photosBy = byPlace(photos);
  const eventsBy = byPlace(events);

  const eventView = (e) => ({
    id: e.id, place_id: e.place_id, title: e.title, kind: e.kind, category: e.category, starts_on: e.starts_on,
    ends_on: e.ends_on, date_note: e.date_note, url: e.url, image_url: e.image_url, price: e.price, summary: e.summary,
    translations: parseJson(e.translations, {}),
  });
  // Seasonal places (a Christmas market square) only appear while something is on there.
  const keep = (p) => p.layer_id !== 'seasonal' || eventsBy.has(p.id);

  return {
    city: { ...city, translations: parseJson(city.translations, {}) },
    events: events.results.map(eventView),
    areas: areas.results.map((z) => ({ ...z, route: parseJson(z.route, []), translations: parseJson(z.translations, {}) })),
    layers: layers.results.map((l) => ({ ...l, translations: parseJson(l.translations, {}) })),
    places: places.results.filter(keep).map((p) => ({
      ...p,
      path: parseJson(p.path, null),
      translations: parseJson(p.translations, {}),
      booking_required: Boolean(p.booking_required),
      hours_verified: Boolean(p.hours_verified),
      favourite: Boolean(p.favourite),
      hours: (hoursBy.get(p.id) || []).map(({ weekday, opens, closes }) => ({ weekday, opens, closes })),
      photos: (photosBy.get(p.id) || []).map(photoView),
      events: (eventsBy.get(p.id) || []).map(eventView),
    })),
  };
}

export function photoView(ph) {
  const src =
    ph.source === 'commons'
      ? `/photos/commons/${encodeURIComponent(ph.file)}`
      : ph.source === 'r2'
        ? `/media/${ph.file}`
        : ph.file;
  return { id: ph.id, src, author: ph.author, license: ph.license, source_url: ph.source_url };
}

const PLACE_RULES = {
  summary: text(400),
  tip: text(400),
  hours_note: text(200),
  price: text(80),
  website: optional(text(300)),
  favourite: (v) => typeof v === 'boolean',
  hours_verified: (v) => typeof v === 'boolean',
  rating: (v) => Number.isInteger(v) && v >= 0 && v <= 5,
  area: optional(text(80)),
};

/** Edit the parts of a place that are meant to be changed from the site. */
export async function updatePlace(db, id, body) {
  const fields = pick(body, PLACE_RULES);
  const keys = Object.keys(fields);
  if (keys.length === 0) throw new HttpError(400, 'Nothing to update');
  const values = keys.map((k) => (typeof fields[k] === 'boolean' ? Number(fields[k]) : k === 'area' ? fields[k] || null : fields[k]));
  const res = await db
    .prepare(
      `update places set ${keys.map((k) => `${k} = ?`).join(', ')},
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') where id = ?`,
    )
    .bind(...values, id)
    .run();
  if (!res.meta.changes) throw new HttpError(404, 'Unknown place');
}
