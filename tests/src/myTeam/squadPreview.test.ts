// The Squad tab's preview squad (src/myTeam/preview.ts) holds seasons a real totals row could:
// a player with no minutes has nothing else counted either (PR #1003: Watkins showed 5 goals
// beside 0 minutes).

import { describe, expect, it } from "vitest";
import { previewMyTeam } from "../../../src/myTeam/preview";
import { league } from "../../support/src/shell.harness";

describe("the preview's squad", () => {
  it("never shows goals, cards or clean sheets beside no minutes, and no points with no matches", () => {
    const squad = previewMyTeam.useTeamSquad(league.leagueId)!;
    const unplayed = squad.players.filter(({ stats }) => stats !== null && stats.minutes === 0);
    expect(unplayed.length).toBeGreaterThan(0);
    for (const { stats, seasonPoints } of unplayed) {
      expect(Object.values(stats!).every((value) => value === 0)).toBe(true);
      expect(seasonPoints).toBeNull();
    }
  });
});
