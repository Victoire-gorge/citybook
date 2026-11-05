-- Who added an item through a share link ('Chilly'). Null = the owner.
alter table adventure_items add column added_by text;
