/**
 * Reminders without a server (extra E): DUO writes a calendar file with
 * alarms. Opening it adds the events to Apple Calendar, which then gives
 * real lock-screen notifications. Only the titles you choose go into it.
 */
export interface IcsEvent {
  uid: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM, local; all-day if missing
  minutes?: number;
  alarmMinutesBefore?: number;
  repeatWeekly?: boolean;
}

const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function buildIcs(events: IcsEvent[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DUO//Fitness//EN', 'CALSCALE:GREGORIAN'];
  for (const e of events) {
    const d = e.date.replace(/-/g, '');
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@duo.local`, `DTSTAMP:${stamp()}`, `SUMMARY:${esc(e.title)}`);
    if (e.time) {
      const t = e.time.replace(':', '') + '00';
      const end = new Date(`${e.date}T${e.time}:00`);
      end.setMinutes(end.getMinutes() + (e.minutes ?? 45));
      const pad = (n: number) => String(n).padStart(2, '0');
      const endStr = `${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}T${pad(end.getHours())}${pad(end.getMinutes())}00`;
      lines.push(`DTSTART:${d}T${t}`, `DTEND:${endStr}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${d}`);
    }
    if (e.repeatWeekly) lines.push('RRULE:FREQ=WEEKLY');
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, `TRIGGER:-PT${e.alarmMinutesBefore ?? 15}M`, 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
