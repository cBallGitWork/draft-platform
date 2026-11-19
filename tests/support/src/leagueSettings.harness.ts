// League settings' tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { LeagueGameweek } from "../../../convex/gameweeks/leagueGameweeks";
import type { ScoringStartView } from "../../../convex/gameweeks/scoringStart";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { leagueSettingsOf } from "../../../convex/rules/leagueSettingsPart";
import type { DraftStart, LeagueSettingsSeam, SettingsView, TeamInOrder } from "../../../src/leagueSettings/seam";
import type { Revision } from "../../../src/rules/rulesEdits";
import { CHANGES_FROM } from "./scoring.harness";
import type { PendingClaim, WaiversView } from "../../../src/myTeam/claims/seam";
import { NO_WAIVERS } from "./myTeam.harness";
import { PL_GAMEWEEKS } from "../convex/footballRows.harness";
import type { TradeInReview } from "../../../convex/trades/reviewScreen";

/** The rules row the fake server's settings are from. */
export const REVISION = "rules-1" as Revision;

/** Three teams, in the order they joined: the draft order unless a test says. The last has no
 *  manager, and the commissioner doesn't pick for it. */
export const TEAMS_IN_ORDER: TeamInOrder[] = ["Saka Potatoes", "Kroos Control", "Pique Blinders"].map((name, index) => ({
  teamId: `team-${index + 1}` as Id<"teams">,
  name,
  commissionerPicks: index === 2 ? false : null,
}));

/** What the fake server holds: the settings as `view` says, the first rules' by default; `loading`
 *  keeps them on their way (undefined). `teamOrder` is the draft order, TEAMS_IN_ORDER by default; `draftStarted` fixes it. */
export type LeagueSettingsData = {
  /** The settings; the season always has PL_GAMEWEEKS gameweeks, and the presets are the first
   *  rules' unless `presetNames` says. */
  view?: Omit<SettingsView, "seasonGameweeks" | "presetNames">;
  presetNames?: string[];
  /** Every trade in review in the league: none unless a test says. */
  tradesInReview?: TradeInReview[];
  loading?: boolean;
  teamOrder?: TeamInOrder[];
  draftStarted?: boolean;
  waivers?: WaiversView;
  /** Every team's pending claims, which a commissioner with no team sees: none by default. */
  claims?: PendingClaim[];
  /** Keeps the claims on their way (undefined). */
  claimsLoading?: boolean;
  /** The scoring start and the ticked gameweeks: none set and none ticked unless a test says. */
  scoringStart?: ScoringStartView;
  /** The draft's start: no date, not started and no rounds (no squad size), with TEAMS_IN_ORDER's teams, unless a test says. */
  draftStart?: Partial<DraftStart>;
  /** The league's gameweeks, for the Gameweeks widget: none unless a test says. */
  gameweeks?: LeagueGameweek[];
};

/** Saving succeeds from CHANGES_FROM, and a draft order at once, unless a test says otherwise. */
export function fakeLeagueSettings({
  view = { part: leagueSettingsOf(FIRST_RULES), revision: REVISION, changesFrom: CHANGES_FROM },
  loading = false,
  teamOrder = TEAMS_IN_ORDER,
  draftStarted = false,
  waivers = NO_WAIVERS,
  claims = [],
  claimsLoading = false,
  scoringStart = { start: null, ticked: [], seasonBegun: false },
  draftStart = {},
  gameweeks = [],
  presetNames = FIRST_RULES.presets.map(({ name }) => name),
  tradesInReview = [],
}: LeagueSettingsData = {}) {
  const draft: DraftStart = { startsAt: null, started: false, rounds: null, teams: TEAMS_IN_ORDER.length, ...draftStart };
  return {
    useSettings: vi.fn<LeagueSettingsSeam["useSettings"]>(() => (loading ? undefined : { ...view, seasonGameweeks: PL_GAMEWEEKS, presetNames })),
    save: vi.fn<LeagueSettingsSeam["save"]>(async () => CHANGES_FROM),
    useTeamOrder: vi.fn<LeagueSettingsSeam["useTeamOrder"]>(() => ({ teams: teamOrder, started: draftStarted })),
    saveTeamOrder: vi.fn<LeagueSettingsSeam["saveTeamOrder"]>(async () => null),
    drawTeamOrder: vi.fn<LeagueSettingsSeam["drawTeamOrder"]>(async () => null),
    markForCommissioner: vi.fn<LeagueSettingsSeam["markForCommissioner"]>(async () => null),
    useScoringStart: vi.fn<LeagueSettingsSeam["useScoringStart"]>(() => scoringStart),
    setScoringStart: vi.fn<LeagueSettingsSeam["setScoringStart"]>(async () => null),
    useGameweeks: vi.fn<LeagueSettingsSeam["useGameweeks"]>(() => gameweeks),
    useDraftStart: vi.fn<LeagueSettingsSeam["useDraftStart"]>(() => draft),
    setDraftStart: vi.fn<LeagueSettingsSeam["setDraftStart"]>(async () => null),
    useWaivers: vi.fn<LeagueSettingsSeam["useWaivers"]>(() => waivers),
    usePendingClaims: vi.fn<LeagueSettingsSeam["usePendingClaims"]>(() => (claimsLoading ? undefined : claims)),
    useTradesInReview: vi.fn<LeagueSettingsSeam["useTradesInReview"]>(() => tradesInReview),
  };
}
