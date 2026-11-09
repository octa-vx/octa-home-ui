/** HA reports `YYYY-MM-DD HH:MM:SS`, while `<input type="datetime-local">` requires a `T` separator. */
export function toDatetimeLocal(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(value);
  return match ? `${match[1]}T${match[2]}` : '';
}

/** Converts HA's 0..255 brightness to a percentage. */
export function brightnessToPercent(brightness: unknown): number {
  if (typeof brightness !== 'number') return 0;
  return Math.round((Math.min(255, Math.max(0, brightness)) / 255) * 100);
}
