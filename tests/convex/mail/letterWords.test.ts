import type { Infer } from "convex/values";
import { expect, test } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { eventLetter } from "../../../convex/mail/letterWords";
import type { leagueEvent } from "../../../convex/schema";

// The letters for the league events joining, gameweeks, deletion and rules file (#73, #74, #75,
// #25): each says who did what, and the facts the event carries.

const WHO = "commish@example.com";
const TEAM = "team-1" as Id<"teams">;
const ANN = "ann@example.com";
const IN_JANUARY = Date.parse("2027-01-15T12:00:00Z");

const LETTERS: [Infer<typeof leagueEvent>, string, string][] = [
  [{ kind: "deletionStarted", name: "Sunday League", deletesAt: IN_JANUARY }, "Sunday League is being deleted", "Friday 15 January"],
  [{ kind: "deletionUndone", name: "Sunday League" }, "Sunday League is no longer being deleted", "undid deleting"],
  [{ kind: "gameweekUsed", gameweek: 12, used: false }, "Gameweek 12 won't count", "took gameweek 12 out"],
  [{ kind: "gameweekUsed", gameweek: 12, used: true }, "Gameweek 12 counts again", "count for the league again"],
  [{ kind: "invited", email: ANN, teamId: null, teamName: null }, `${ANN} was invited`, "to manage a new team"],
  [{ kind: "inviteResent", email: ANN, teamId: TEAM, teamName: "Saka Potatoes" }, `${ANN}'s invite was sent again`, "Saka Potatoes"],
  [{ kind: "inviteCancelled", email: ANN, teamId: null, teamName: null }, `${ANN}'s invite was cancelled`, "cancelled"],
  [
    { kind: "joinedByInvite", email: ANN, teamId: TEAM, teamName: "Saka Potatoes", invitedBy: WHO },
    `${ANN} joined as manager of Saka Potatoes`,
    `took up ${WHO}'s invite`,
  ],
  [{ kind: "joinRequestApproved", email: ANN, teamId: TEAM, teamName: "Saka Potatoes" }, `${ANN} joined as manager of Saka Potatoes`, "approved"],
  [{ kind: "inviteLinkMade", replacedOne: true }, "The league has a new invite link", "the old one no longer works"],
  [{ kind: "inviteLinkSwitchedOff" }, "The invite link is off", "switched"],
  [
    { kind: "rulesChanged", fromGameweek: 9, changed: ["scoring", "deadline"] },
    "The league's rules change from gameweek 9",
    "scoring and deadline, from gameweek 9.",
  ],
  [
    { kind: "rulesChanged", fromGameweek: 9, changed: ["oddTeamOut", "gamesPerGameweek", "tieBreaks"] },
    "The league's rules change from gameweek 9",
    "changed the league's odd team out, games a gameweek and tie-breaks, from gameweek 9.",
  ],
  [
    { kind: "rulesChanged", fromGameweek: 9, changed: ["scoring"], categories: ["Goals scored", "Assists"], wholePointsOnly: true },
    "The league's rules change from gameweek 9",
    "changed the league's scoring, from gameweek 9. The scoring changed for Goals scored and Assists, and points are now whole only.",
  ],
  [
    { kind: "rulesChanged", fromGameweek: 9, changed: ["scoring"], wholePointsOnly: false },
    "The league's rules change from gameweek 9",
    "changed the league's scoring, from gameweek 9. Points can now be fractions.",
  ],
];

test.each(LETTERS)("the %o letter names it and who did it", (event, subject, inBody) => {
  const letter = eventLetter(event, WHO);
  expect(letter.subject).toBe(subject);
  expect(letter.body).toContain(inBody);
  if (event.kind !== "joinedByInvite") expect(letter.body).toContain(WHO);
});
