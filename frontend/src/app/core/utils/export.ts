import { TimeBlock } from '../models/planner.models';
import { dateForWeekDay, isoDate } from './time';

function stamp(date: string, time: string): string {
  const compact = `${date.replaceAll('-', '')}T${time.replace(':', '')}00`;
  return compact;
}

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function weekToIcs(blocks: TimeBlock[], weekStart = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Organi Day//ES',
    'CALSCALE:GREGORIAN'
  ];

  for (const block of blocks) {
    if (block.category === 'sleep') continue;
    const date = block.date ?? isoDate(dateForWeekDay(block.dayOfWeek, weekStart));
    lines.push(
      'BEGIN:VEVENT',
      `UID:${block.id}@organi-day`,
      `DTSTAMP:${stamp(isoDate(), '00:00')}`,
      `DTSTART:${stamp(date, block.start)}`,
      `DTEND:${stamp(date, block.end)}`,
      `SUMMARY:${escapeText(block.title)}`
    );
    if (block.location) lines.push(`LOCATION:${escapeText(block.location)}`);
    if (block.notes) lines.push(`DESCRIPTION:${escapeText(block.notes)}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadText(filename: string, content: string, type = 'text/plain'): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
