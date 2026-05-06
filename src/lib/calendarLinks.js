function normalizeDate(value) {
  const text = String(value ?? '').trim().replaceAll('/', '-');
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }
  return null;
}

function addDays(dateText, offset = 1) {
  const date = new Date(`${dateText}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return dateText;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function formatCalendarDate(dateText) {
  return String(dateText ?? '').replaceAll('-', '');
}

function buildEventBody(details = {}) {
  return [
    details.note,
    details.sourceName ? `來源：${details.sourceName}` : null,
    details.url ? `連結：${details.url}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function createGoogleCalendarLink({ title, startDate, endDate, note, sourceName, url, location }) {
  const normalizedStart = normalizeDate(startDate);
  if (!normalizedStart) return null;
  const normalizedEnd = normalizeDate(endDate) ?? addDays(normalizedStart, 1);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${formatCalendarDate(normalizedStart)}/${formatCalendarDate(normalizedEnd)}`,
    details: buildEventBody({ note, sourceName, url }),
  });

  if (location) {
    params.set('location', location);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function createIcsDataUrl({ title, startDate, endDate, note, sourceName, url, location }) {
  const normalizedStart = normalizeDate(startDate);
  if (!normalizedStart) return null;
  const normalizedEnd = normalizeDate(endDate) ?? addDays(normalizedStart, 1);
  const uid = `${title}-${normalizedStart}`.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 48) || 'tw-active-tracker-event';
  const payload = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TW Active Tracker//Event Calendar//TW',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}@tw-active-tracker`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`,
    `DTSTART;VALUE=DATE:${formatCalendarDate(normalizedStart)}`,
    `DTEND;VALUE=DATE:${formatCalendarDate(normalizedEnd)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${buildEventBody({ note, sourceName, url }).replace(/\n/g, '\\n')}`,
    location ? `LOCATION:${location}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');

  return `data:text/calendar;charset=utf-8,${encodeURIComponent(payload)}`;
}

export function buildCalendarLinks(options) {
  return {
    googleUrl: createGoogleCalendarLink(options),
    icsUrl: createIcsDataUrl(options),
  };
}
