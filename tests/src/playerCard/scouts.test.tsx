// The player card's scouts (#375; spec/19, Scouts and The report; the approved card): Send a scout
// with how many of the team's three are free, and the panel of his team's reports on him, the newest
// dated with older ones under it. The server's own rules (a fourth refused, one per player, the
// report 24 hours on, hidden from other teams) are tested in tests/convex/scouting/.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { scoutRefusals } from "../../../convex/scouting/scoutWords";
import {
  freeScoutsWords,
  noReportWords,
  olderReportWords,
  reportDayWords,
  SCOUT_REPORT_TITLE,
  scoutOutWords,
  sendScoutWords,
} from "../../../src/scouting/scouts/words";
import { HELD, openCard, RICE, SAKA } from "../../support/src/playerCardScreen.harness";
import { NO_SCOUTS_OUT, scoutOut, scoutReported, type ScoutsData } from "../../support/src/scouts.harness";
import { league } from "../../support/src/shell.harness";

const DUE = Date.parse("2026-11-09T12:00:00Z");
const NEWER = Date.parse("2026-11-05T10:00:00Z");
const OLDER = Date.parse("2026-10-12T10:00:00Z");
const withScouts = (scouts: ScoutsData) => ({ ...HELD, scouts });
const reportPanel = () => screen.getByRole("region", { name: SCOUT_REPORT_TITLE });

describe("Send a scout", () => {
  it("sends one to him, saying how many of the team's scouts are free", async () => {
    const app = openCard(RICE, withScouts({ mine: { ...NO_SCOUTS_OUT, out: [{ playerCode: SAKA.code, name: SAKA.name, sentAt: 0, dueAt: DUE }] } }));
    expect(await screen.findByText(freeScoutsWords(2, 3))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: sendScoutWords }));
    expect(app.playerCard.sendScout).toHaveBeenCalledWith(league.leagueId, RICE.code);
  });

  it("can't be pressed with every scout out", async () => {
    const out = (playerCode: number) => ({ playerCode, name: "", sentAt: 0, dueAt: DUE });
    openCard(RICE, withScouts({ mine: { ...NO_SCOUTS_OUT, out: [out(1), out(2), out(3)] } }));
    expect(await screen.findByText(freeScoutsWords(0, 3))).toBeTruthy();
    expect((screen.getByRole("button", { name: sendScoutWords }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("can't be pressed with a scout already on him", async () => {
    openCard(RICE, withScouts({ mine: { ...NO_SCOUTS_OUT, out: [{ playerCode: RICE.code, name: RICE.name, sentAt: 0, dueAt: DUE }] } }));
    expect((await screen.findByRole("button", { name: sendScoutWords }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("says the server's refusal", async () => {
    openCard(RICE, withScouts({ refusal: scoutRefusals.allOut(3) }));
    await userEvent.click(await screen.findByRole("button", { name: sendScoutWords }));
    expect(await screen.findByText(scoutRefusals.allOut(3))).toBeTruthy();
  });

  it("isn't there, nor the report panel, for someone who runs no team", async () => {
    openCard(RICE, withScouts({ mine: null, trips: null }));
    await screen.findByText(RICE.fullName);
    expect(screen.queryByRole("button", { name: sendScoutWords })).toBeNull();
    expect(screen.queryByRole("region", { name: SCOUT_REPORT_TITLE })).toBeNull();
  });

  it("isn't there for a player who has left the Premier League", async () => {
    const gone = { ...RICE, gone: true };
    openCard(gone, { cards: [gone] });
    await screen.findByText(RICE.fullName);
    expect(screen.queryByRole("button", { name: sendScoutWords })).toBeNull();
  });
});

describe("the scout report", () => {
  it("shows the newest report, dated, with an older one under it that opens in place", async () => {
    openCard(RICE, withScouts({ trips: [scoutReported(RICE.code, OLDER, "Plays deeper so far."), scoutReported(RICE.code, NEWER, "A strong fit as a Number 10.")] }));
    const panel = within(await screen.findByRole("region", { name: SCOUT_REPORT_TITLE }));
    expect(panel.getByText(reportDayWords(NEWER))).toBeTruthy();
    expect(panel.getByText("A strong fit as a Number 10.")).toBeTruthy();
    expect(panel.queryByText("Plays deeper so far.")).toBeNull();

    await userEvent.click(panel.getByRole("button", { name: olderReportWords(OLDER) }));
    expect(panel.getByText("Plays deeper so far.")).toBeTruthy();
  });

  it("says when a scout out on him reports, and that he isn't scouted with none", async () => {
    openCard(RICE, withScouts({ trips: [scoutOut(RICE.code, DUE)] }));
    expect(await screen.findByText(scoutOutWords(DUE))).toBeTruthy();
    expect(within(reportPanel()).queryByText(noReportWords)).toBeNull();
  });

  it("says he isn't scouted with no trip to him", async () => {
    openCard(RICE, withScouts({ trips: [] }));
    expect(within(await screen.findByRole("region", { name: SCOUT_REPORT_TITLE })).getByText(noReportWords)).toBeTruthy();
  });
});
