export const VALID_TIERS = ['RDA', 'DA'] as const;
export const VALID_SOFTWARE = [
  'OPEN_DENTAL', 'DENTRIX', 'EAGLESOFT', 'CURVE_DENTAL', 'CARESTREAM', 'OTHER',
] as const;
const VALID_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const TIME_RE = /^\d{2}:\d{2}$/;

// Returns an error string, or null if valid.
// Expected shape: { "MON": ["09:00-17:00", ...], ... }
export function validateAvailability(av: unknown): string | null {
  if (typeof av !== 'object' || av === null || Array.isArray(av)) {
    return 'availability must be a plain object';
  }
  for (const [day, windows] of Object.entries(av)) {
    if (!VALID_DAYS.includes(day)) {
      return `invalid day key "${day}" — must be one of ${VALID_DAYS.join(', ')}`;
    }
    if (!Array.isArray(windows)) {
      return `"${day}" must map to an array of time-window strings`;
    }
    for (const w of windows) {
      if (typeof w !== 'string') {
        return `time windows for "${day}" must be strings`;
      }
      const parts = w.split('-');
      if (parts.length !== 2 || !TIME_RE.test(parts[0]) || !TIME_RE.test(parts[1])) {
        return `invalid time window "${w}" for "${day}" — expected "HH:MM-HH:MM"`;
      }
      if (parts[0] >= parts[1]) {
        return `time window "${w}" for "${day}" has start >= end`;
      }
    }
  }
  return null;
}
