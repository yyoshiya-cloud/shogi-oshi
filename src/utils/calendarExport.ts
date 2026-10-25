import { Match, Player } from '../types/shogi';

/**
 * Generate a Google Calendar Web Intent link
 */
export function getGoogleCalendarUrl(match: Match, p1: Player, p2: Player): string {
  const title = `【将棋】${match.tournament} (${p1.name} vs ${p2.name})`;
  
  // Format date: match.date is "YYYY-MM-DD", match.time is "09:00"
  const startDateTime = new Date(`${match.date}T${match.time}:00`);
  // Assume match lasts ~7 hours or until evening
  const endDateTime = new Date(startDateTime.getTime() + 8 * 60 * 60 * 1000);

  const formatUtc = (d: Date) => {
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const datesParam = `${formatUtc(startDateTime)}/${formatUtc(endDateTime)}`;
  
  const details = [
    `【棋戦】${match.tournament}`,
    `【対局】${p1.name} (${p1.rank}) vs ${p2.name} (${p2.rank})`,
    `【対局場】${match.venue}`,
    `【持ち時間】${match.timeControl}`,
    `【中継予定】${match.broadcast.join(', ')}`,
    match.highlights ? `【見どころ】${match.highlights}` : '',
    match.kifuUrl ? `【棋譜・速報】${match.kifuUrl}` : '',
    '',
    '将棋推し活アプリより登録'
  ].filter(Boolean).join('\n');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: datesParam,
    details: details,
    location: match.venue,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate and download an iCalendar (.ics) file for Android/iOS/Desktop calendar apps
 */
export function downloadICSFile(match: Match, p1: Player, p2: Player): void {
  const startDateTime = new Date(`${match.date}T${match.time}:00`);
  const endDateTime = new Date(startDateTime.getTime() + 8 * 60 * 60 * 1000);

  const formatUtc = (d: Date) => {
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Shogi Fan App//JP//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:shogi-match-${match.id}-${Date.now()}@shogi-fan.app`,
    `DTSTAMP:${formatUtc(new Date())}`,
    `DTSTART:${formatUtc(startDateTime)}`,
    `DTEND:${formatUtc(endDateTime)}`,
    `SUMMARY:【将棋】${match.tournament} ${p1.name} vs ${p2.name}`,
    `DESCRIPTION:${match.tournament}\\n対局者: ${p1.name} vs ${p2.name}\\n会場: ${match.venue}\\n持ち時間: ${match.timeControl}\\n中継: ${match.broadcast.join(', ')}`,
    `LOCATION:${match.venue}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'DESCRIPTION:対局30分前リマインダー',
    'ACTION:DISPLAY',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shogi_${match.date}_${p1.name}_vs_${p2.name}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
