// League home's Calendar tab (#2683; spec/12 S12.24; docs/design/approved/home/, The Calendar tab):
// a UK month, Monday first, six weeks, each day's deadlines, draft and waiver runs in its cell.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOME_CALENDAR_PATH, HOME_PATH } from "../../../src/frame/menu";
import { calendarEventWords, todayWords } from "../../../src/home/words";
import { menuWords } from "../../../src/shared/words";
import type { CalendarEvent } from "../../../src/home/seam";
import type { HomeData } from "../../support/src/home.harness";
import { league, manager, openApp } from "../../support/src/shell.harness";

const TODAY = Date.parse("2026-11-18T12:00:00Z");
beforeEach(() => vi.useFakeTimers({ now: TODAY, toFake: ["Date"] }));
afterEach(() => vi.useRealTimers());

const events: CalendarEvent[] = [
  { kind: "waiverRun", at: Date.parse("2026-10-29T18:00:00Z") },
  { kind: "firstKickoff", at: Date.parse("2026-11-06T20:00:00Z"), gameweek: 11 },
  { kind: "deadline", at: Date.parse("2026-11-07T11:00:00Z"), gameweek: 11 },
  { kind: "draft", at: Date.parse("2026-11-14T19:00:00Z") },
  { kind: "waiverRun", at: Date.parse("2026-11-19T18:00:00Z") },
  { kind: "deadline", at: Date.parse("2026-12-05T11:00:00Z"), gameweek: 14 },
];
const openCalendar = (home: HomeData = { calendar: events }) => openApp(HOME_CALENDAR_PATH, manager, { home });
const grid = (name: string) => screen.findByRole("grid", { name });
const day = (name: string) => screen.getByRole("gridcell", { name });

describe("S12.24 the month grid", () => {
  it("S12.24 opens from Home's Calendar tab on this UK month, Monday first, six weeks", async () => {
    const app = openApp(HOME_PATH, manager, { home: { calendar: events } });
    await userEvent.click(await screen.findByRole("link", { name: menuWords.calendar }));
    expect(app.path()).toBe(HOME_CALENDAR_PATH);
    const month = await grid("November 2026");
    expect(within(month).getAllByRole("columnheader").map((head) => head.textContent)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    const cells = within(month).getAllByRole("gridcell");
    expect([cells.length, cells[0].getAttribute("aria-label"), cells.at(-1)?.getAttribute("aria-label")]).toEqual([42, "Monday 26 October", "Sunday 6 December"]);
    expect(app.home.useCalendarMonth).toHaveBeenCalledWith(league.leagueId, { year: 2026, month: 11 });
  });

  it("S12.24 each day holds its deadline, the draft and its waiver runs at their UK times; a gameweek shows only as its deadline", async () => {
    openCalendar();
    await grid("November 2026");
    expect(day("Saturday 7 November").textContent).toBe(`7${calendarEventWords.deadline(11)}11:00`);
    expect(day("Friday 6 November").textContent).toBe("6");
    expect(day("Saturday 14 November").textContent).toBe(`14${calendarEventWords.draft}19:00`);
    expect(day("Thursday 19 November").textContent).toBe(`19${calendarEventWords.waiverRun}18:00`);
  });

  it("S12.24 shows the months either side's events in their days on the grid", async () => {
    openCalendar();
    await grid("November 2026");
    expect(day("Thursday 29 October").textContent).toBe(`29${calendarEventWords.waiverRun}18:00`);
    expect(day("Saturday 5 December").textContent).toBe(`5${calendarEventWords.deadline(14)}11:00`);
  });

  it("S12.24 marks today", async () => {
    openCalendar();
    await grid("November 2026");
    expect(screen.getByRole("gridcell", { current: "date" }).textContent).toBe(`18${todayWords}`);
  });

  it("S12.24 ◄ and ► step a month, and Today comes back", async () => {
    const app = openCalendar();
    await userEvent.click(await screen.findByRole("button", { name: "December 2026" }));
    expect((await grid("December 2026")).querySelector("[aria-current]")).toBeNull();
    expect(app.home.useCalendarMonth).toHaveBeenLastCalledWith(league.leagueId, { year: 2027, month: 1 });
    await userEvent.click(screen.getByRole("button", { name: todayWords }));
    await userEvent.click(await screen.findByRole("button", { name: "October 2026" }));
    expect(await grid("October 2026")).toBeTruthy();
  });
});
