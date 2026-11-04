// League settings' tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { leagueSettingsOf } from "../../../convex/rules/leagueSettingsPart";
import type { LeagueSettingsSeam, SettingsView, TeamInOrder } from "../../../src/leagueSettings/seam";
import type { Revision } from "../../../src/rules/rulesDraft";
import { CHANGES_FROM } from "./scoring.harness";

/** The rules row the fake server's settings are from. */
export const REVISION = "rules-1" as Revision;

/** Three teams, in the order they joined: the draft order unless a test says. */
export const TEAMS_IN_ORDER: TeamInOrder[] = ["Saka Potatoes", "Kroos Control", "Pique Blinders"].map((name, index) => ({
  teamId: `team-${index + 1}` as Id<"teams">,
  name,
}));

/** What the fake server holds: the settings as `view` says, the first rules' by default; null for
 *  a league with no rules; `loading` keeps them on their way (undefined). `teamOrder` is the
 *  commissioner's draft order, TEAMS_IN_ORDER by default. */
export type LeagueSettingsData = { view?: SettingsView | null; loading?: boolean; teamOrder?: TeamInOrder[] };

/** Saving succeeds from CHANGES_FROM, and a draft order at once, unless a test says otherwise. */
export function fakeLeagueSettings({
  view = { part: leagueSettingsOf(FIRST_RULES), revision: REVISION, changesFrom: CHANGES_FROM },
  loading = false,
  teamOrder = TEAMS_IN_ORDER,
}: LeagueSettingsData = {}) {
  return {
    useSettings: vi.fn<LeagueSettingsSeam["useSettings"]>(() => (loading ? undefined : view)),
    save: vi.fn<LeagueSettingsSeam["save"]>(async () => CHANGES_FROM),
    useTeamOrder: vi.fn<LeagueSettingsSeam["useTeamOrder"]>(() => teamOrder),
    saveTeamOrder: vi.fn<LeagueSettingsSeam["saveTeamOrder"]>(async () => null),
    drawTeamOrder: vi.fn<LeagueSettingsSeam["drawTeamOrder"]>(async () => null),
  };
}
