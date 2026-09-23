import { type CalendarEvent } from '@workspace/api-client-react';

export const manualEventsKey = 'bayzati-manual-calendar-events';
export const reviewedEventsKey = 'bayzati-reviewed-calendar-events';

export const readStored = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
};

export const getManualEvents = (): CalendarEvent[] => readStored<CalendarEvent[]>(manualEventsKey, []);
export const getReviewedEvents = (): Record<string, boolean> => readStored<Record<string, boolean>>(reviewedEventsKey, {});
