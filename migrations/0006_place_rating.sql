-- Vic's own rating of a place or an activity, from 1 to 5 stars. 0 = not rated.
alter table places add column rating integer not null default 0 check (rating between 0 and 5);
