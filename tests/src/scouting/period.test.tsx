// Scouting's Period picker (#1028, story 3; the approved picture): Season, Last 4 and Last 6
// gameweeks, which the list's figures, his panel's minutes and per 90, and Compare all follow.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { compareWithAnotherWords, noFigureWords, noPeriodPointsWords, panelMinutesWords, per90Words, periodColumns, periodLabel, periodWords } from "../../../src/scouting/words";
import { columnHeadIn } from "../../support/src/columnHeads";
import { PERIOD_GAMEWEEKS_SHOWN } from "../../support/src/scouting.harness";
import { HELD, lastAsk, openOnAll, PALMER, rowOf, SAKA, table } from "../../support/src/scoutingScreen.harness";
import { league } from "../../support/src/shell.harness";

const choosePeriod = (words: string) => userEvent.selectOptions(screen.getByRole("combobox", { name: periodLabel }), words);

describe("the Period picker", () => {
  it("opens on the season and offers the last 4 and last 6 gameweeks", async () => {
    const app = await openOnAll();
    const picker = screen.getByRole("combobox", { name: periodLabel });
    expect((picker as HTMLSelectElement).value).toBe("season");
    expect(within(picker).getAllByRole("option").map((option) => option.textContent)).toEqual([periodWords.season, periodWords.last4, periodWords.last6]);
    expect(lastAsk(app)[4]).toBe("season");
  });

  it("asks the list for the chosen period, and the figures' heads name its gameweeks on hover", async () => {
    const app = await openOnAll();
    await choosePeriod(periodWords.last6);
    expect(lastAsk(app)[4]).toBe("last6");
    const heads = periodColumns("last6", PERIOD_GAMEWEEKS_SHOWN.last6);
    expect(heads.minutes!.long).toBe("Minutes over gameweeks 4 to 9");
    expect(columnHeadIn(table(), heads.minutes!)).toBeTruthy();
    expect(columnHeadIn(table(), heads.points!)).toBeTruthy();
  });

  it("over a few gameweeks, a player with none of his matches there scored reads '—', saying why", async () => {
    await openOnAll();
    await choosePeriod(periodWords.last4);
    const points = within(rowOf("Saka")).getAllByRole("cell").find((cell) => cell.textContent === noFigureWords && cell.title !== "")!;
    expect(points.title).toBe(noPeriodPointsWords);
  });

  it("his panel's minutes and per 90, and Compare, follow it", async () => {
    const app = await openOnAll({ ...HELD, totals: { [SAKA.code]: { minutes: 450, goals_scored: 3 }, [PALMER.code]: { minutes: 300 } } });
    await choosePeriod(periodWords.last4);
    await userEvent.click(rowOf("Saka"));
    const panel = screen.getByRole("region", { name: /^W/ });
    expect(within(panel).getByText(panelMinutesWords("last4", null))).toBeTruthy();
    expect(within(panel).getByText(per90Words("last4"))).toBeTruthy();
    expect(app.scouting.usePer90.mock.lastCall![3]).toBe("last4");
    await userEvent.click(within(panel).getByRole("button", { name: compareWithAnotherWords }));
    await userEvent.click(rowOf("Palmer"));
    expect(app.scouting.useComparison.mock.lastCall).toEqual([league.leagueId, [SAKA.code, PALMER.code], null, "last4"]);
  });
});
