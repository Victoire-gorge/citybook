// Limited-time things: date labels and overlap with an adventure.
import { t, formatShort, formatRange } from './i18n.js';

/** "14 Nov – 3 Jan", "Until 25 Jan", "From 12 Nov", or the free-text note when dates are unknown. */
export function eventDates(e) {
  if (e.starts_on && e.ends_on) return formatRange(e.starts_on, e.ends_on);
  if (e.ends_on) return t('event.until', { date: formatShort(e.ends_on) });
  if (e.starts_on) return t('event.from', { date: formatShort(e.starts_on) });
  return e.date_note || '';
}

/** Days of the adventure when the event is on (all of them when its dates are open-ended). */
export function overlapDays(e, days) {
  return days.filter((d) => (!e.starts_on || d >= e.starts_on) && (!e.ends_on || d <= e.ends_on));
}

/** True when we know the event is on during part of the adventure. */
export function isOnDuring(e, adventure) {
  if (!e.starts_on && !e.ends_on) return false;
  return (!e.starts_on || e.starts_on <= adventure.ends_on) && (!e.ends_on || e.ends_on >= adventure.starts_on);
}
