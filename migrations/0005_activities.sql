-- Activities (cruises, day trips, markets...) are places of the 'activities' layer,
-- with a few extra details shown on the Activities page.
alter table places add column category text;   -- classic, offbeat, outdoors, food, evening, daytrip
alter table places add column duration text;   -- '1 h 10', 'Half a day'
alter table places add column best_time text;  -- 'At night', 'Weekend mornings'
