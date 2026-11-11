// The platform's settings before the admin sets them, and why a value is refused (spec/15, #1555).
// Pure, with no Convex functions, so the browser's preview can show the defaults too.

import type { Infer } from "convex/values";
import type { platformSettingName } from "../schema";

export type SettingName = Infer<typeof platformSettingName>;

/** Every platform setting, as the admin's dashboard shows and saves them. */
export type PlatformSettings = Record<SettingName, number>;

/** How long after full time a match's stats stay open to corrections (spec/07), until set. */
const DEFAULT_STAT_CORRECTION_WINDOW_MINUTES = 60;

/** How many scouts each team has (spec/19, Scouts: "3 scouts, a number the site sets"), until set. */
export const DEFAULT_SCOUTS_PER_TEAM = 3;

/** Each setting until the admin sets it. League home's matchday mode (spec/12, League home) runs
 *  from this many hours before a matchday's first kickoff to this many after its last final
 *  whistle ("hours the site can tune"). */
export const FIRST_PLATFORM_SETTINGS: PlatformSettings = {
  statCorrectionWindowMinutes: DEFAULT_STAT_CORRECTION_WINDOW_MINUTES,
  scoutsPerTeam: DEFAULT_SCOUTS_PER_TEAM,
  matchdayHoursBefore: 3,
  matchdayHoursAfter: 2,
};

/** Why a setting is refused, as the admin is told it. */
export const settingRefusals: Record<SettingName, (value: number) => string> = {
  statCorrectionWindowMinutes: (value) => `The stat-correction window is a whole number of minutes, 0 or more, not ${value}.`,
  scoutsPerTeam: (value) => `A team's scouts are a whole number, 0 or more, not ${value}.`,
  matchdayHoursBefore: (value) => `Matchday mode's hours before are a whole number, 0 or more, not ${value}.`,
  matchdayHoursAfter: (value) => `Matchday mode's hours after are a whole number, 0 or more, not ${value}.`,
};
