import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adventureToIcs } from '../src/lib/ics.js';

const adventure = {
  title: 'Chilli in Paris',
  items: [
    { id: 'a', day: '2026-11-16', start_time: '10:00', end_time: null, title: 'Louvre, Denon wing', note: '', lat: 48.86, lng: 2.33, place_id: 'musee-du-louvre' },
    { id: 'b', day: '2026-11-17', start_time: null, title: 'Passages; walk', note: 'line one\nline two' },
    { id: 'c', day: null, title: 'Idea not scheduled' },
  ],
};

test('timed, all-day and unscheduled items', () => {
  const ics = adventureToIcs(adventure, { now: new Date('2026-11-03T12:00:00Z'), origin: 'https://x.dev' });
  assert.match(ics, /DTSTART;TZID=Europe\/Paris:20261116T100000/);
  assert.match(ics, /DTEND;TZID=Europe\/Paris:20261116T110000/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261117\r\nDTEND;VALUE=DATE:20261118/);
  assert.match(ics, /SUMMARY:Louvre\\, Denon wing/);
  assert.match(ics, /SUMMARY:Passages\\; walk/);
  assert.match(ics, /DESCRIPTION:line one\\nline two/);
  assert.match(ics, /URL:https:\/\/x.dev\/#musee-du-louvre/);
  assert.doesNotMatch(ics, /Idea not scheduled/);
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 2);
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
});

test('long lines are folded', () => {
  const ics = adventureToIcs({ title: 'x', items: [{ id: 'z', day: '2026-11-16', title: 'é'.repeat(80), note: '' }] });
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75);
});
