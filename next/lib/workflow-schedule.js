export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function parseWorkflowSchedule(value, amount) {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid schedule');
  const { days, time, timeZone, enabled = true } = value;
  if (!Array.isArray(days) || !days.length || days.some(day => !Number.isInteger(day) || day < 0 || day > 6)) {
    throw new Error('Choose at least one valid weekday');
  }
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Choose a valid time (HH:mm)');
  if (typeof timeZone !== 'string' || timeZone.length > 80) throw new Error('Choose a valid time zone');
  try { new Intl.DateTimeFormat('en', { timeZone }).format(); } catch { throw new Error('Choose a valid time zone'); }
  if (typeof enabled !== 'boolean') throw new Error('Invalid schedule enabled value');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Scheduled workflows need an amount greater than zero');
  return { days: [...new Set(days)].sort((a,b) => a-b), time, timeZone, enabled };
}

export function describeWorkflowSchedule(schedule) {
  if (!schedule) return '';
  return `${schedule.enabled ? '' : 'Paused · '}${schedule.days.length === 7 ? 'Every day' : schedule.days.map(day => WEEKDAYS[day]).join(', ')} · ${schedule.time} · ${schedule.timeZone}`;
}
