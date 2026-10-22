// The dashboard's feeds tab (#35; spec/15 The admin): reached from the dashboard's tabs by the
// admin alone; each feed's last arrival and state, the matches whose scoring is behind, and the
// stat corrections that came after a lock.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ALWAYS_OWED, judgeFeed } from "../../../convex/admin/feedState";
import { FEED_SCHEDULES, lateAfterMs } from "../../../convex/shared/feedSchedule";
import { DAY_MS, HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";
import { ADMIN_FEEDS_PATH, ADMIN_PATH } from "../../../src/admin/paths";
import type { FeedsReport } from "../../../src/admin/seam";
import {
  ADMIN_TITLE,
  behindTitle,
  changeWords,
  correctionsTitle,
  moreCorrectionsWords,
  feedNames,
  feedsLoadingWords,
  feedStateWords,
  feedsTabWords,
  feedsTitle,
  fullTimeWords,
  lastErrorWords,
  neverWords,
  noCorrectionsWords,
  noneBehindWords,
  positionsTabWords,
  seenWords,
  whenWords,
} from "../../../src/admin/words";
import { LEAGUES_PATH } from "../../../src/leagues/paths";
import { LEAGUES_TITLE } from "../../../src/leagues/words";
import { admin, commissioner, openApp } from "../../support/src/shell.harness";

const NOW = Date.parse("2026-10-17T12:00:00Z");
const NONE_ON_RECORD = { lastRunAt: null, lastSuccessAt: null, lastError: null };

/** Every feed with no run on record, nothing behind and no correction. */
const QUIET: FeedsReport = {
  now: NOW,
  feeds: [
    { feed: "football", state: "notRunningYet", ...NONE_ON_RECORD },
    { feed: "positions", state: "notRunningYet", ...NONE_ON_RECORD },
    { feed: "matchStats", state: "notRunningYet", ...NONE_ON_RECORD },
    { feed: "liveStats", state: "notRunningYet", ...NONE_ON_RECORD },
  ],
  behind: [],
  moreBehind: false,
  moreCorrections: false,
  corrections: [],
};

/** `report` with one feed's row replaced. */
function withFeed(report: FeedsReport, row: FeedsReport["feeds"][number]): FeedsReport {
  return { ...report, feeds: report.feeds.map((each) => (each.feed === row.feed ? row : each)) };
}

const openFeeds = (feeds: FeedsReport = QUIET) => openApp(ADMIN_FEEDS_PATH, admin, { admin: { feeds } });

/** The feeds table's row group for `name`: the feed's row and its error's. */
async function feedRows(name: string) {
  const table = within(await screen.findByRole("region", { name: feedsTitle })).getByRole("table");
  const row = within(table).getByRole("rowheader", { name: new RegExp(name) }).closest("tbody");
  if (row === null) throw new Error(`no rows for ${name}`);
  return row;
}

describe("reaching the feeds", () => {
  it("the admin moves between the dashboard's tabs, and the one he is on is marked", async () => {
    const app = openApp(ADMIN_PATH, admin, { admin: { feeds: QUIET } });
    await userEvent.click(await screen.findByRole("link", { name: feedsTabWords }));
    expect(await screen.findByRole("region", { name: feedsTitle })).toBeTruthy();
    expect(app.path()).toBe(ADMIN_FEEDS_PATH);
    expect(screen.getByRole("heading", { level: 1, name: ADMIN_TITLE })).toBeTruthy();
    expect(screen.getByRole("link", { name: feedsTabWords }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: positionsTabWords }).getAttribute("aria-current")).toBeNull();

    await userEvent.click(screen.getByRole("link", { name: positionsTabWords }));
    expect(app.path()).toBe(ADMIN_PATH);
  });

  it("anyone else is sent back to Your leagues", async () => {
    const app = openApp(ADMIN_FEEDS_PATH, commissioner);
    await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE });
    expect(app.path()).toBe(LEAGUES_PATH);
  });

  it("says so while the feeds load", async () => {
    openApp(ADMIN_FEEDS_PATH, admin, { admin: {} });
    expect(await screen.findByRole("status")).toHaveProperty("textContent", feedsLoadingWords);
  });
});

describe("the feeds", () => {
  it("#35 Done: a feed stopped past its schedule shows as late, in the event colour, with when it last arrived", async () => {
    const stoppedAt = NOW - lateAfterMs(FEED_SCHEDULES.football) - MINUTE_MS;
    const runs = { lastRun: { ranAt: stoppedAt, failure: null }, lastSuccessAt: stoppedAt };
    const state = judgeFeed(runs, FEED_SCHEDULES.football, ALWAYS_OWED, NOW);
    openFeeds(withFeed(QUIET, { feed: "football", state, lastRunAt: stoppedAt, lastSuccessAt: stoppedAt, lastError: null }));

    const rows = await feedRows(feedNames.football.name);
    const late = within(rows).getByText(feedStateWords.late);
    expect(late.className).toContain("text-event");
    expect(within(rows).getAllByRole("row")[0].className).toContain("shadow-event-edge");
    expect(within(rows).getByText("6 hours ago")).toBeTruthy();
    expect(within(rows).getByText(whenWords(stoppedAt))).toBeTruthy();
  });

  it("a failing feed shows its last error and when it came", async () => {
    const lastError = { at: NOW - 10 * MINUTE_MS, error: "FPL answered 503" };
    openFeeds(withFeed(QUIET, { feed: "matchStats", state: "failing", lastRunAt: lastError.at, lastSuccessAt: NOW - 3 * HOUR_MS, lastError }));

    const rows = await feedRows(feedNames.matchStats.name);
    expect(within(rows).getByText(feedStateWords.failing).className).toContain("text-event");
    expect(within(rows).getByText("3 hours ago")).toBeTruthy();
    expect(within(rows).getAllByRole("row")[1].textContent).toBe(`${lastErrorWords(lastError.at)} FPL answered 503`);
  });

  it("a feed on time is plain, one never run says Never, and one run by hand says it isn't scheduled, muted", async () => {
    const report = withFeed(withFeed(QUIET, { feed: "liveStats", state: "fine", lastRunAt: NOW - 2 * MINUTE_MS, lastSuccessAt: NOW - 2 * MINUTE_MS, lastError: null }), {
      feed: "positions",
      state: "notScheduled",
      lastRunAt: NOW - 3 * DAY_MS,
      lastSuccessAt: NOW - 3 * DAY_MS,
      lastError: null,
    });
    openFeeds(report);

    const live = await feedRows(feedNames.liveStats.name);
    expect(within(live).getByText(feedStateWords.fine).className).not.toMatch(/text-event|text-muted/);
    expect(within(live).getByText("2 minutes ago")).toBeTruthy();
    expect(within(await feedRows(feedNames.positions.name)).getByText(feedStateWords.notScheduled).className).toContain("text-muted");
    expect(within(await feedRows(feedNames.positions.name)).getByText("3 days ago")).toBeTruthy();
    const football = await feedRows(feedNames.football.name);
    expect(within(football).getByText(neverWords)).toBeTruthy();
    expect(within(football).getByText(feedStateWords.notRunningYet).className).toContain("text-muted");
  });
});

describe("corrections", () => {
  it("says so when more came than it shows, never cutting them silently", async () => {
    const correction = { fixtureCode: 1, match: { home: "Hull City", away: "Everton" }, playerCode: 7, player: "Saka", seenAt: NOW, changes: [{ stat: "assists", locked: 0, sent: 1 }] };
    openFeeds({ ...QUIET, corrections: [correction], moreCorrections: true });

    const panel = await screen.findByRole("region", { name: correctionsTitle });
    expect(within(panel).getByText(moreCorrectionsWords(1)).className).toContain("text-event");
  });
});

describe("scoring", () => {
  it("says how many matches are behind, as a figure, and names each with its full time", async () => {
    const fullTimeAt = NOW - 3 * HOUR_MS;
    openFeeds({ ...QUIET, behind: [{ fixtureCode: 1, match: { home: "Hull City", away: "Everton" }, fullTimeAt }], moreBehind: true });

    const panel = await screen.findByRole("region", { name: behindTitle });
    expect(within(panel).getByText("1+").className).toContain("text-figure");
    const match = within(within(panel).getByRole("list", { name: behindTitle })).getByRole("listitem");
    expect(match.textContent).toBe(`Hull City v Everton${fullTimeWords(fullTimeAt)}`);
  });

  it("a correction after the lock shows the player, the match and the stat as locked and as sent", async () => {
    const seenAt = NOW - HOUR_MS;
    const change = { stat: "assists", locked: 1, sent: 0 };
    openFeeds({ ...QUIET, corrections: [{ fixtureCode: 1, match: null, playerCode: 7, player: "Ndiaye", seenAt, changes: [change] }] });

    const panel = await screen.findByRole("region", { name: correctionsTitle });
    const correction = within(within(panel).getByRole("list", { name: correctionsTitle })).getByRole("listitem");
    expect(correction.textContent).toBe(`Ndiaye, Match 1${changeWords(change)}${seenWords(seenAt)}`);
  });

  it("says so when nothing is behind and no stat changed after a lock", async () => {
    openFeeds();
    expect(await screen.findByText(noneBehindWords)).toBeTruthy();
    expect(screen.getByText(noCorrectionsWords)).toBeTruthy();
  });
});
