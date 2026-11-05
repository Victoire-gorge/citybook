-- Who added an item through a share link ('Chilli'). Null = the owner.
alter table adventure_items add column added_by text;
