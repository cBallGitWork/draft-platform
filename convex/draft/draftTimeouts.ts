import type { Doc, Id } from "../_generated/dataModel";

// The timeout count (spec/04, Auto-pick; #1136). Each time a team's clock runs out the draft picks
// for it (draftPicks.ts `autoPick`), and that counts as one of its timeouts, whether or not its
// manager is online, across the whole draft, not only in a row (Craig, 4 Nov 2026, on #1091). Once
// a team has the league's number of timeouts it goes on auto-pick; with "never" it doesn't, and the
// clock runs for every pick (Craig, 2 Nov 2026). Its first pick on auto-pick still waits its full
// clock, "incase they forgot to switch off", and each after is made at once (Craig, 4 Nov 2026, on
// #1091). A team with no manager is picked for at once anyway, so its picks aren't timeouts. Its
// manager can take control back himself, which sets his count to 0 (Craig, 4 Nov 2026: "ok"; #1094).
// He can also turn auto-pick on himself, before the draft or during it: then it is "chosen", every
// pick of his is made at once, the one on the clock too, and his count stays as it is (Craig, 5 Nov
// 2026, on #1100).

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

/** The draft's timeouts once `teamId`'s manager takes control back from auto-pick: off it, and his
 *  count back to 0 (Craig, 4 Nov 2026: "ok"). */
export function afterTakeBack(timeouts: Timeouts | undefined, teamId: Id<"teams">): Timeouts {
  return (timeouts ?? []).map((team) => (team.teamId === teamId ? { teamId, count: 0 } : team));
}

/** The draft's timeouts once the commissioner undoes a pick the draft made when `teamId`'s clock ran
 *  out: that timeout off its count, and the team off auto-pick if that timeout `putOnAutoPick`
 *  (Craig, 4 Nov 2026: "yes"). A count its manager has since set to 0 by taking control back stays 0. */
export function afterUndoneTimeout(timeouts: Timeouts | undefined, teamId: Id<"teams">, putOnAutoPick: boolean): Timeouts {
  return (timeouts ?? []).map((team) => {
    if (team.teamId !== teamId) return team;
    const { autoPick, count } = team;
    const kept = putOnAutoPick ? undefined : autoPick;
    return { teamId, count: Math.max(0, count - 1), ...(kept !== undefined && { autoPick: kept }) };
  });
}

/** The draft's timeouts once `teamId`'s manager turns auto-pick on himself: "chosen", its count as
 *  it was (Craig, 5 Nov 2026, on #1100). */
export function afterChoosing(timeouts: Timeouts | undefined, teamId: Id<"teams">): Timeouts {
  const before = timeouts?.find((team) => team.teamId === teamId);
  const after: Timeouts[number] = { teamId, count: before?.count ?? 0, autoPick: "chosen" };
  return before === undefined ? [...(timeouts ?? []), after] : (timeouts ?? []).map((team) => (team === before ? after : team));
}

/** Whether `teamId`'s manager turned auto-pick on himself, so its picks count no timeout. */
export function choseAutoPick(timeouts: Timeouts | undefined, teamId: Id<"teams">): boolean {
  return timeouts?.some((team) => team.teamId === teamId && team.autoPick === "chosen") ?? false;
}

/** Whether `teamId` is on auto-pick: its timeouts reached the league's limit, or its manager chose it. */
export function isOnAutoPick(timeouts: Timeouts | undefined, teamId: Id<"teams">): boolean {
  return timeouts?.some((team) => team.teamId === teamId && team.autoPick !== undefined) ?? false;
}

/** Whether the draft picks for `team` as its clock starts: it has no manager and the commissioner
 *  hasn't said "I'll pick for this one" (#1095), or it is on auto-pick past its first pick there or by its manager's choice. */
export function picksAtOnce(timeouts: Timeouts | undefined, team: Doc<"teams">): boolean {
  if (team.managerEmail === undefined) return team.commissionerPicks !== true;
  return timeouts?.some(({ teamId, autoPick }) => teamId === team._id && (autoPick === "atOnce" || autoPick === "chosen")) ?? false;
}
