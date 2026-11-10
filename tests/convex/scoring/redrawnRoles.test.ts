import { describe, expect, test } from "vitest";
import { SPORTMONKS_STAT_IDS } from "../../../convex/football/sportmonks/sportmonksStats";
import type { Cell } from "../../../convex/lineup/pitch";
import { DEFAULT_ROLES } from "../../../convex/lineup/roles";
import { FIRST_ROLES, FIRST_SCORING_WITH_ROLES } from "../../../convex/scoring/draftedRoleAdjustments";
import { scoreMatch } from "../../../convex/scoring/scoring";

// The roles redrawn around Sportmonks' stats (spec/05 `S05.27`, `S05.28`; #1196, #1445): each role
// a plain mix of what it is best at and one bad action, as docs/roles-first-values.md lists them.
// A hand-made stat line per role, its points worked out by hand from the bars in
// draftedRoleAdjustments.ts.

const CELL: Record<keyof typeof DEFAULT_ROLES, Cell> = {
  GK: { area: "goalkeeper", lane: "centre" },
  FB: { area: "defence", lane: "left" },
  CB: { area: "defence", lane: "centre" },
  WB: { area: "defensiveMidfield", lane: "left" },
  CDM: { area: "defensiveMidfield", lane: "centre" },
  WM: { area: "midfield", lane: "left" },
  CM: { area: "midfield", lane: "centre" },
  W: { area: "attackingMidfield", lane: "left" },
  CAM: { area: "attackingMidfield", lane: "centre" },
  ST: { area: "attack", lane: "centre" },
};

/** Each role: its slot, the stat line, and the role's points: bonus bars reached less cost bars. */
const LINES: [role: string, slot: keyof typeof CELL, stats: Record<string, number>, points: number][] = [
  // 2 × 1 goal + 2 on target = 4, +3; 1 big chance missed, −1.
  ["poacher", "ST", { goals_scored: 1, ontarget_scoring_att: 2, big_chance_missed: 1 }, 2],
  ["targetMan", "ST", { aerial_won: 6, aerial_lost: 5 }, 1],
  ["inBehindStriker", "ST", { won_contest: 2, was_fouled: 1, total_offside: 1 }, 1],
  ["pressingForward", "ST", { won_tackle: 1, interception: 1, ball_recovery: 5 }, 3],
  // 2 key passes + 1 through ball + 1 dribble + 20 accurate passes ÷ 10 = 6, +2; 2 dispossessed, −2.
  ["falseNine", "ST", { total_att_assist: 2, accurate_through_ball: 1, won_contest: 1, accurate_pass: 20, dispossessed: 2 }, 0],
  ["winger", "W", { accurate_cross: 2, won_contest: 2 }, 2],
  ["dribbler", "W", { won_contest: 4, was_fouled: 3, dispossessed: 4 }, 1],
  ["insideForward", "W", { total_scoring_att: 3, ontarget_scoring_att: 1, goals_scored: 1 }, 2],
  ["widePlaymaker", "W", { total_att_assist: 1, big_chance_created: 1, poss_lost_all: 16 }, 0],
  ["pressingWinger", "W", { won_tackle: 2, ball_recovery: 3, fouls: 1 }, 1],
  ["trackingWinger", "W", { won_tackle: 1, interception: 1, total_clearance: 1, challenge_lost: 1 }, 1],
  ["numberTen", "CAM", { total_att_assist: 2, big_chance_created: 1 }, 2],
  ["attackingMidfieldShadowStriker", "CAM", { total_scoring_att: 2, ontarget_scoring_att: 1 }, 1],
  ["carrier", "CAM", { won_contest: 3, was_fouled: 1, dispossessed: 3 }, -1],
  ["pressingTen", "CAM", { won_tackle: 2, interception: 1, ball_recovery: 2, fouls: 2 }, 1],
  ["wideMidfielder", "WM", { ball_recovery: 6, total_tackle: 2 }, 2],
  ["defensiveWinger", "WM", { total_tackle: 2, interception: 1, outfielder_block: 1, challenge_lost: 2 }, 2],
  ["wideMidfieldPlaymaker", "WM", { accurate_long_balls: 2, total_long_balls: 3, total_att_assist: 1 }, 2],
  // 2 accurate crosses + 6 crosses ÷ 2 = 5, +2; 4 failed, under the first cost bar.
  ["crosser", "WM", { accurate_cross: 2, total_cross: 6 }, 2],
  ["shotStopper", "GK", { saves: 5, saved_ibox: 3, error_lead_to_goal: 1 }, 2],
  ["sweeperKeeper", "GK", { interception: 1, total_clearance: 1 }, 2],
  // 8 accurate long balls + 20 accurate passes ÷ 5 = 12, +2; 10 failed long balls, −1.
  ["distributor", "GK", { accurate_long_balls: 8, total_long_balls: 18, accurate_pass: 20 }, 1],
  ["commandingKeeper", "GK", { good_high_claim: 2, punches: 1 }, 2],
  ["boxToBox", "CM", { ball_recovery: 4, won_tackle: 2, total_scoring_att: 1, dispossessed: 1 }, 1],
  // 2 tackles won + 1 interception + 4 ground duels won (6 duels won less 2 in the air) = 7, +2.
  ["ballWinner", "CM", { won_tackle: 2, interception: 1, duel_won: 6, aerial_won: 2, fouls: 1 }, 1],
  ["attackingEight", "CM", { won_contest: 2, total_att_assist: 2, dispossessed: 2 }, 2],
  ["midfieldEngine", "CM", { ball_recovery: 6, interception: 2, accurate_pass: 30 }, 3],
  ["attackingWingBack", "WB", { accurate_cross: 1, total_att_assist: 1, won_contest: 1, dispossessed: 3 }, 1],
  ["holdingWingBack", "WB", { won_tackle: 2, interception: 1, ball_recovery: 4, challenge_lost: 1 }, 2],
  ["completeWingBack", "WB", { accurate_cross: 1, won_contest: 1, won_tackle: 1, interception: 1, poss_lost_all: 14 }, 1],
  ["invertedWingBack", "WB", { accurate_pass: 40, total_att_assist: 1 }, 3],
  ["goalscoringWingBack", "WB", { total_scoring_att: 1, ontarget_scoring_att: 1, goals_scored: 1, big_chance_missed: 1 }, 2],
  ["overlappingFullBack", "FB", { accurate_cross: 1, total_cross: 3, dispossessed: 1 }, 2],
  ["invertedFullBack", "FB", { accurate_pass: 50, total_pass: 61 }, 1],
  ["playmakingFullBack", "FB", { accurate_long_balls: 2, total_long_balls: 4, total_att_assist: 1 }, 1],
  ["defensiveFullBack", "FB", { won_tackle: 1, interception: 2, total_clearance: 3 }, 2],
  ["metronome", "CDM", { accurate_pass: 60, total_pass: 68 }, 2],
  ["quarterback", "CDM", { accurate_long_balls: 4, total_long_balls: 10 }, 1],
  // The third centre-back: 3 clearances + 1 block + 1 interception = 5, +2.
  ["halfBack", "CDM", { total_clearance: 3, outfielder_block: 1, interception: 1 }, 2],
  ["engine", "CDM", { ball_recovery: 8, interception: 2, accurate_pass: 40, challenge_lost: 3 }, 2],
  ["tower", "CDM", { aerial_won: 4, aerial_lost: 2 }, 1],
  ["destroyer", "CDM", { won_tackle: 3, duel_won: 5, aerial_won: 2, fouls: 5 }, 2],
  ["stopper", "CB", { won_tackle: 1, outfielder_block: 1, aerial_won: 3 }, 2],
  ["ballPlayingDefender", "CB", { accurate_long_balls: 4, total_long_balls: 11, accurate_pass: 40 }, 1],
  ["noNonsenseCentreBack", "CB", { total_clearance: 6, total_long_balls: 5, error_lead_to_shot: 1 }, 2],
  ["attackingCentreBack", "CB", { total_scoring_att: 1, goals_scored: 1 }, 2],
  ["sweeper", "CB", { ball_recovery: 5, interception: 2, challenge_lost: 1 }, 1],
  ["libero", "CB", { won_contest: 1, accurate_pass: 40 }, 2],
];

describe("each role's points for a hand-made stat line (docs/roles-first-values.md; S05.27)", () => {
  test("every role of the default set has a line here", () => {
    const every = Object.values(DEFAULT_ROLES).flat().map(({ key }) => key);
    expect(LINES.map(([role]) => role).toSorted()).toEqual(every.toSorted());
  });

  test.each(LINES)("%s", (role, slot, stats, points) => {
    expect(scoreMatch({ minutes: 90, ...stats }, FIRST_SCORING_WITH_ROLES, CELL[slot], role).role?.points).toBe(points);
  });
});

// S05.28
test("every stat a role counts is one Sportmonks sends, or an own stat made of them", () => {
  const ownStats = new Map((FIRST_SCORING_WITH_ROLES.ownStats ?? []).map(({ stat, parts }) => [stat, parts.map((part) => part.stat)]));
  const sent = (stat: string) => stat in SPORTMONKS_STAT_IDS;
  for (const { role, bonus, cost } of FIRST_ROLES) {
    for (const { stat } of [...bonus.parts, ...cost.parts]) {
      expect(sent(stat) || (ownStats.get(stat) ?? []).every(sent), `${role}: ${stat}`).toBe(true);
      if (!sent(stat)) expect(ownStats.has(stat), `${role}: ${stat}`).toBe(true);
    }
  }
});

test("a role's cost is one bad action (S05.27)", () => {
  for (const { role, cost } of FIRST_ROLES) expect(cost.parts, role).toHaveLength(1);
});
