// Words that name the same thing on several screens say it the same way on each: the league's
// table, its bench and the league average each have one home, the screens re-export it.

import { expect, it } from "vitest";
import { menuWords } from "../../src/frame/words";
import { TABLE_TITLE as homeTableTitle, leagueAverageWords as homeLeagueAverage } from "../../src/home/words";
import { BENCH_TITLE as matchupBench, leagueAverageWords as matchupLeagueAverage } from "../../src/matchup/words";
import { benchedInWords as squadBenchedIn } from "../../src/myTeam/squad/words";
import { BENCH_TITLE as tacticsBench, benchPlaceWords as tacticsBenchPlace } from "../../src/myTeam/tactics/words";
import { benchShort, leagueAverageWords as myTeamLeagueAverage } from "../../src/myTeam/words";
import { TABLE_TITLE as tableTitle, leagueAverageWords as tableLeagueAverage } from "../../src/table/words";

it("names the league's table as the menu does, on league home and the table screen", () => {
  expect(tableTitle).toBe("Table");
  expect(tableTitle).toBe(menuWords.table);
  expect(homeTableTitle).toBe(tableTitle);
});

it("calls the bench the same on the Tactics tab and the matchup", () => {
  expect(tacticsBench).toBe("Bench");
  expect(matchupBench).toBe(tacticsBench);
});

it("names a bench place the same on the Squad and Tactics tabs, the first sub S1", () => {
  expect(benchShort(1)).toBe("S1");
  expect(tacticsBenchPlace(0)).toBe(benchShort(1));
  expect(squadBenchedIn(3)).toBe(`Bench, ${benchShort(3)}`);
});

it("calls the league average the same on the table, My team, league home and the matchup", () => {
  expect(tableLeagueAverage).toBe("League average");
  for (const words of [myTeamLeagueAverage, homeLeagueAverage, matchupLeagueAverage]) expect(words).toBe(tableLeagueAverage);
});
