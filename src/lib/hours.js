// Opening hours helpers, shared by the front end, the Worker and the seed script.
// Weekdays are ISO: 1 = Monday ... 7 = Sunday.

const DAY_CODES = { Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6, Su: 7 };

/**
 * Parse a compact spec like "Mo,Th 09:00-18:00; We-Fr 10:00-21:00" into rows
 * { weekday, opens, closes }. Throws on anything it does not understand.
 */
export function parseHours(spec) {
  if (!spec) return [];
  const rows = [];
  for (const part of spec.split(';').map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^([A-Za-z,-]+)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
    if (!m) throw new Error(`Cannot read opening hours "${part}"`);
    const [, days, opens, closes] = m;
    for (const weekday of expandDays(days)) rows.push({ weekday, opens, closes });
  }
  return rows;
}

function expandDays(days) {
  const out = [];
  for (const token of days.split(',')) {
    const [from, to] = token.split('-');
    const a = DAY_CODES[from];
    const b = to ? DAY_CODES[to] : a;
    if (!a || !b) throw new Error(`Unknown day "${token}"`);
    for (let d = a; ; d = (d % 7) + 1) {
      out.push(d);
      if (d === b) break;
    }
  }
  return out;
}

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Weekday (1-7) and minutes since midnight in Paris for a given instant. */
export function parisClock(date = new Date(), timeZone = 'Europe/Paris') {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const weekday = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[parts.weekday];
  return { weekday, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

/**
 * Status of a place right now: 'open', 'closed', or 'unknown' when no hours are known.
 * Handles slots that close after midnight (e.g. 18:00-01:00).
 */
export function openStatus(rows, clock) {
  if (!rows || rows.length === 0) return { state: 'unknown' };
  const yesterday = clock.weekday === 1 ? 7 : clock.weekday - 1;
  for (const r of rows) {
    const o = toMinutes(r.opens);
    const c = toMinutes(r.closes);
    const overnight = c <= o;
    if (r.weekday === clock.weekday && clock.minutes >= o && (overnight || clock.minutes < c)) {
      return { state: 'open', until: r.closes };
    }
    if (overnight && r.weekday === yesterday && clock.minutes < c) {
      return { state: 'open', until: r.closes };
    }
  }
  return { state: 'closed' };
}

/** Rows for one weekday, sorted, as "09:00–18:00" strings. */
export function hoursForDay(rows, weekday) {
  return rows
    .filter((r) => r.weekday === weekday)
    .sort((a, b) => a.opens.localeCompare(b.opens))
    .map((r) => `${r.opens}–${r.closes}`);
}
