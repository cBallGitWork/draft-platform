import type { Doc, Id } from "../_generated/dataModel";

// The timeout count (spec/04, Auto-pick; #1136). Each time a team's clock runs out the draft picks
// for it (draftPicks.ts `autoPick`), and that counts as one of its timeouts, whether or not its
// manager is online, across the whole draft, not only in a row (Craig, 4 Nov 2026, on #1091). Once
// a team has the league's number of timeouts it goes on auto-pick; with "never" it doesn't, and the
// clock runs for every pick (Craig, 2 Nov 2026). Its first pick on auto-pick still waits its full
// clock, "incase they forgot to switch off", and each after is made at once (Craig, 4 Nov 2026, on
// #1091). A team with no manager is picked for at once anyway, so its picks aren't timeouts. Not
// built yet: taking control back, which sets the count to 0 (#1094).

type Timeouts = NonNullable<Doc<"drafts">["timeouts"]>;

/** The draft's timeouts once `teamId`'s clock has run out once more, the league allowing `limit`
 *  timeouts before auto-pick, or never with null. */
export function afterTimeout(timeouts: Timeouts | undefined, teamId: Id<"teams">, limit: number | null): Timeouts {
  const before = timeouts?.find((team) => team.teamId === teamId);
  const count = (before?.count ?? 0) + 1;
  const autoPick: Timeouts[number]["autoPick"] = before?.autoPick !== undefined ? "atOnce" : limit !== null && count >= limit ? "fullClock" : undefined;
  const after: Timeouts[number] = { teamId, count, ...(autoPick !== undefined && { autoPick }) };
  return before === undefined ? [...(timeouts ?? []), after] : (timeouts ?? []).map((team) => (team === before ? after : team));
}

/** Whether the draft picks for `teamId` as its clock starts, as it is on auto-pick past its first
 *  pick there. */
export function picksAtOnce(timeouts: Timeouts | undefined, teamId: Id<"teams">): boolean {
  return timeouts?.some((team) => team.teamId === teamId && team.autoPick === "atOnce") ?? false;
}
