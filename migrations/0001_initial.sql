-- citybook: initial schema
-- Conventions: ids are text, dates are 'YYYY-MM-DD', times 'HH:MM', timestamps ISO 8601 UTC,
-- lists and translations are JSON text, booleans are 0/1.
-- `translations` holds per-language overrides, e.g. '{"fr":{"name":"...","summary":"..."}}'.
-- The base text columns are in English (the site's first language).

-- Cities, so a second city can be added without changing the schema.
create table cities (
  id text primary key,                 -- 'paris'
  name text not null,
  lat real not null,
  lng real not null,
  zoom integer not null default 13,
  translations text not null default '{}'
);

-- Map layers: covered passages, museums, pretty streets...
create table layers (
  id text primary key,                 -- 'passages', 'museums'...
  city_id text not null references cities(id),
  name text not null,
  color text not null,                 -- main colour of the sticker / line
  shape text not null check (shape in ('point', 'line')),
  icon text not null default 'dot',    -- sticker drawn by the front end
  sort integer not null default 0,
  visible_by_default integer not null default 1,
  translations text not null default '{}'
);

create table places (
  id text primary key,
  layer_id text not null references layers(id),
  name text not null,
  summary text not null default '',    -- one or two lines, shown on the polaroid
  tip text not null default '',        -- Vic's own handwritten note
  address text not null default '',
  lat real not null,
  lng real not null,
  path text,                           -- JSON list of polylines [[[lat,lng],...],...] for streets and passages
  website text,
  booking_required integer not null default 0,
  price text not null default '',      -- free text: 'Free', '€15', 'Free under 26'
  hours_note text not null default '', -- 'Late opening on Fridays'
  hours_verified integer not null default 0, -- 1 once checked on the official site
  wikidata_id text,
  favourite integer not null default 0,
  translations text not null default '{}',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index places_layer on places(layer_id);

-- Weekly opening hours. No row for a weekday = closed that day.
-- weekday: 1 = Monday ... 7 = Sunday (ISO). closes may be after midnight ('01:00').
create table opening_hours (
  place_id text not null references places(id) on delete cascade,
  weekday integer not null check (weekday between 1 and 7),
  opens text not null,
  closes text not null,
  primary key (place_id, weekday, opens)
);

create table photos (
  id text primary key,
  place_id text not null references places(id) on delete cascade,
  source text not null check (source in ('commons', 'r2', 'url')),
  file text not null,                  -- Commons file name, R2 key or full URL
  author text,
  license text,
  source_url text,                     -- page to credit
  sort integer not null default 0
);
create index photos_place on photos(place_id);

-- Exhibitions, shows, screenings... Either at a known place or standalone.
create table events (
  id text primary key,
  place_id text references places(id) on delete set null,
  title text not null,
  kind text not null default 'other'
    check (kind in ('exhibition', 'show', 'concert', 'screening', 'comedy', 'party', 'talk', 'other')),
  starts_on text,
  ends_on text,
  url text,
  image_url text,
  price text not null default '',
  summary text not null default '',
  source text not null default 'manual', -- 'manual' or the name of the watcher that found it
  translations text not null default '{}',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index events_dates on events(starts_on, ends_on);
create index events_place on events(place_id);

-- People who can sign in. Only Vic at first.
create table users (
  id text primary key,
  email text not null unique,
  name text not null,
  password_hash text not null,         -- 'pbkdf2$<iterations>$<salt b64>$<hash b64>'
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table sessions (
  id text primary key,                 -- SHA-256 of the cookie token, never the token itself
  user_id text not null references users(id) on delete cascade,
  expires_at text not null
);

-- An adventure: a stay, a weekend, a day out for someone.
create table adventures (
  id text primary key,
  owner_id text not null references users(id),
  city_id text not null references cities(id),
  title text not null,                 -- 'Chilly in Paris'
  subtitle text not null default '',
  starts_on text not null,
  ends_on text not null,
  party_size integer not null default 1 check (party_size >= 1),
  guests text not null default '[]',   -- JSON list of names
  language text not null default 'en',
  palette text not null default 'blue-yellow',
  cover_key text,                      -- R2 key of the cover photo (private bucket)
  notes text not null default '',
  share_token text unique,             -- set when a read-only share link is created
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  check (ends_on >= starts_on)
);

-- What fills an adventure. day = null means "ideas, not scheduled yet".
create table adventure_items (
  id text primary key,
  adventure_id text not null references adventures(id) on delete cascade,
  day text,
  start_time text,
  end_time text,
  place_id text references places(id) on delete set null,
  event_id text references events(id) on delete set null,
  title text not null default '',      -- free title when it is neither a place nor an event
  note text not null default '',
  sort integer not null default 0,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index adventure_items_adventure on adventure_items(adventure_id, day, sort);
