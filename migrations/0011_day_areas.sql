-- Neighbourhoods added to a day (several per day), with the places hidden for that day.
create table day_areas (
  adventure_id text not null references adventures(id) on delete cascade,
  day text not null,
  area text not null,                     -- 'Montmartre', matches areas.name
  hidden text not null default '[]',      -- JSON list of place ids not shown that day
  sort integer not null default 0,
  primary key (adventure_id, day, area)
);
insert into day_areas (adventure_id, day, area)
  select adventure_id, day, area from adventure_days where area is not null and area <> '';
