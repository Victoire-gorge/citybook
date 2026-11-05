-- Neighbourhoods that group activities (places.area = areas.name), with a suggested walk.
create table areas (
  id text primary key,
  city_id text not null references cities(id),
  name text not null,                 -- 'Montmartre', matches places.area
  summary text not null default '',
  duration text,                      -- 'Half a day'
  best_time text,
  cover_place_id text references places(id) on delete set null,
  route text not null default '[]',   -- JSON list of place ids, in walking order
  sort integer not null default 0,
  translations text not null default '{}',
  unique (city_id, name)
);
