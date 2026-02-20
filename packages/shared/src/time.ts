import { DateTime } from "luxon";

export const ISTANBUL_TZ = "Europe/Istanbul";

export interface DutyWindow {
  dutyDate: string;
  startIso: string;
  endIso: string;
}

export function resolveActiveDutyWindow(now = DateTime.now().setZone(ISTANBUL_TZ)): DutyWindow {
  const local = now.setZone(ISTANBUL_TZ);
  const dutyDate = local.hour < 8 ? local.minus({ days: 1 }).toISODate() : local.toISODate();
  if (!dutyDate) {
    throw new Error("Cannot resolve dutyDate");
  }

  const start = DateTime.fromISO(`${dutyDate}T18:00:00`, { zone: ISTANBUL_TZ });
  const end = start.plus({ days: 1 }).set({
    hour: 8,
    minute: 0,
    second: 0,
    millisecond: 0
  });

  return {
    dutyDate,
    startIso: start.toISO() ?? "",
    endIso: end.toISO() ?? ""
  };
}
