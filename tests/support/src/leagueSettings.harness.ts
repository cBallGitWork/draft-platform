// League settings' tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { leagueSettingsOf } from "../../../convex/rules/leagueSettingsPart";
import type { LeagueSettingsSeam, SettingsView } from "../../../src/leagueSettings/seam";
import type { Revision } from "../../../src/rules/rulesDraft";
import { CHANGES_FROM } from "./scoring.harness";

/** The rules row the fake server's settings are from. */
export const REVISION = "rules-1" as Revision;

/** What the fake server holds: the settings as `view` says, the first rules' by default; null for
 *  a league with no rules; `loading` keeps them on their way (undefined). */
export type LeagueSettingsData = { view?: SettingsView | null; loading?: boolean };

/** Saving succeeds from CHANGES_FROM, unless a test says otherwise. */
export function fakeLeagueSettings({ view = { part: leagueSettingsOf(FIRST_RULES), revision: REVISION, changesFrom: CHANGES_FROM }, loading = false }: LeagueSettingsData = {}) {
  return {
    useSettings: vi.fn<LeagueSettingsSeam["useSettings"]>(() => (loading ? undefined : view)),
    save: vi.fn<LeagueSettingsSeam["save"]>(async () => CHANGES_FROM),
  };
}
