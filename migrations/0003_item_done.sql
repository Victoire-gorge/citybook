-- Tick off a step of the itinerary once it is done.
alter table adventure_items add column done integer not null default 0;
