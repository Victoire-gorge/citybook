// Builds an .ics calendar file from an adventure, for Google Calendar, Apple Calendar...
// Items with a time become events in Paris time; items without a time become all-day events.

const pad = (n) => String(n).padStart(2, '0');
const compact = (date) => date.replace(/-/g, '');
const escapeText = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

function nextDay(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function addHour(time) {
  const [h, m] = time.split(':').map(Number);
  return `${pad(Math.min(h + 1, 23))}:${pad(m)}`;
}

/** Lines longer than 75 octets must be folded (RFC 5545). */
function fold(line) {
  const out = [];
  let rest = line;
  while (new TextEncoder().encode(rest).length > 75) {
    let cut = 74;
    while (new TextEncoder().encode(rest.slice(0, cut)).length > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join('\r\n');
}

export function adventureToIcs(adventure, { now = new Date(), origin = '' } = {}) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//citybook//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeText(adventure.title)}`,
  ];
  for (const item of adventure.items.filter((i) => i.day)) {
    lines.push('BEGIN:VEVENT', `UID:${item.id}@citybook`, `DTSTAMP:${stamp}`);
    if (item.start_time) {
      const end = item.end_time || addHour(item.start_time);
      lines.push(
        `DTSTART;TZID=Europe/Paris:${compact(item.day)}T${item.start_time.replace(':', '')}00`,
        `DTEND;TZID=Europe/Paris:${compact(item.day)}T${end.replace(':', '')}00`,
      );
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compact(item.day)}`, `DTEND;VALUE=DATE:${compact(nextDay(item.day))}`);
    }
    lines.push(`SUMMARY:${escapeText(item.title)}`);
    if (item.note) lines.push(`DESCRIPTION:${escapeText(item.note)}`);
    if (item.lat != null) lines.push(`GEO:${item.lat};${item.lng}`);
    if (item.place_id && origin) lines.push(`URL:${origin}/#${item.place_id}`);
    else if (item.url) lines.push(`URL:${item.url}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function downloadIcs(adventure) {
  const blob = new Blob([adventureToIcs(adventure, { origin: location.origin })], { type: 'text/calendar' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `${adventure.title.replace(/[^\w-]+/g, '-').toLowerCase()}.ics`,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
