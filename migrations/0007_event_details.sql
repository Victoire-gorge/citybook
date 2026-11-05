-- Limited-time things (Christmas markets, exhibitions, festivals...).
alter table events add column category text;                  -- christmas, exhibition, festival, food, event
alter table events add column date_note text not null default ''; -- 'Late November to early January' when exact dates are unknown
