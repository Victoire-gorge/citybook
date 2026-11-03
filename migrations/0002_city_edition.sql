-- The City Edition: new layer colours and pictograms, and a theme for each day of an adventure.

update layers set color = '#365748', icon = 'arch'   where id = 'passages';
update layers set color = '#C67B51', icon = 'museum' where id = 'museums';
update layers set color = '#202521', icon = 'facade' where id = 'buildings';
update layers set color = '#A58AA6', icon = 'wave'   where id = 'streets';
update layers set color = '#5E8C4A', icon = 'tree'   where id = 'squares';

-- Optional title for a day of an adventure ("First steps in Paris").
create table adventure_days (
  adventure_id text not null references adventures(id) on delete cascade,
  day text not null,
  theme text not null default '',
  primary key (adventure_id, day)
);
