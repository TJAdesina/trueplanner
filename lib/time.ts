export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)}\u2013${formatTime(endIso)}`;
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

export function isToday(iso: string, now: Date = new Date()): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function startOfDay(d: Date = new Date()): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function endOfDay(d: Date = new Date()): Date {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export function formatDuration(minutes: number): string {
  const abs = Math.abs(minutes);
  if (abs < 60) return `${abs} min`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export function formatFriendlyDate(d: Date = new Date()): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Percent (0-100) of a working-hours window that has elapsed right now. */
export function percentOfWorkdayElapsed(
  now: Date,
  workStart: string,
  workEnd: string,
  timeZone?: string
): number {
  const [sh, sm] = workStart.split(":").map(Number);
  const [eh, em] = workEnd.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  const total = end - start;
  if (total <= 0) return 0;
  let currentMinutes: number;
  if (timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    currentMinutes =
      Number(parts.find((part) => part.type === "hour")?.value ?? 0) * 60 +
      Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  } else {
    currentMinutes = now.getHours() * 60 + now.getMinutes();
  }
  const elapsed = currentMinutes - start;
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}
