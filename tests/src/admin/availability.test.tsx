// The dashboard's Availability tab (#1209; spec/06 Availability, S06.5; the approved auto-team picture):
// reached from the dashboard's tabs by the admin alone; every player set by hand over the feed; the
// picked one's panel sets his availability, or gives him back to the feed.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { refusals } from "../../../convex/shared/leagueAccess";
import { ADMIN_AVAILABILITY_PATH, ADMIN_PATH } from "../../../src/admin/paths";
import type { AvailabilityRow } from "../../../src/admin/seam";
import {
  ADMIN_TITLE,
  AVAILABILITY_WORDS,
  availabilityChoiceWords,
  availabilityColumns,
  availabilityLoadingWords,
  availabilityTabWords,
  autoTeamReadsWords,
  FEED_CHOICE,
  feedSaysWords,
  findLabel,
  foundListLabel,
  noneSetByHandWords,
  pickPlayerLabel,
  setByHandTitle,
} from "../../../src/admin/words";
import type { AdminData } from "../../support/src/admin.harness";
import { expectColumnHeads } from "../../support/src/columnHeads";
import { admin, commissioner, expectSentToLeagues, openApp } from "../../support/src/shell.harness";

const SAKA: AvailabilityRow = { code: 5, name: "Saka", clubShortName: "ARS", positions: ["W"], feed: "doubtful", set: "available" };
const WATKINS: AvailabilityRow = { code: 8, name: "Watkins", clubShortName: "AVL", positions: ["ST"], feed: "out", set: "doubtful" };
const ISAK: AvailabilityRow = { code: 9, name: "Isak", clubShortName: "LIV", positions: ["ST"], feed: "available", set: null };

const openAvailability = (data: AdminData = { setByHand: [SAKA, WATKINS], players: [SAKA, WATKINS, ISAK] }) =>
  openApp(ADMIN_AVAILABILITY_PATH, admin, { admin: data });

const panelOf = (name: string) => screen.findByRole("region", { name });
const keyOf = (panel: HTMLElement, choice: Parameters<typeof availabilityChoiceWords>[0]) =>
  within(panel).getByRole("radio", { name: availabilityChoiceWords(choice) }) as HTMLInputElement;

describe("reaching Availability", () => {
  it("the admin reaches it from the dashboard's tabs, and the tab is marked", async () => {
    const app = openApp(ADMIN_PATH, admin, { admin: { setByHand: [] } });
    await userEvent.click(await screen.findByRole("link", { name: availabilityTabWords }));
    expect(await screen.findByRole("region", { name: setByHandTitle })).toBeTruthy();
    expect(app.path()).toBe(ADMIN_AVAILABILITY_PATH);
    expect(screen.getByRole("heading", { level: 1, name: ADMIN_TITLE })).toBeTruthy();
    expect(screen.getByRole("link", { name: availabilityTabWords }).getAttribute("aria-current")).toBe("page");
  });

  it("anyone else is sent back to Your leagues", async () => {
    await expectSentToLeagues(ADMIN_AVAILABILITY_PATH, commissioner);
  });

  it("says so while the list loads", async () => {
    openAvailability({});
    expect(await screen.findByRole("status")).toHaveProperty("textContent", availabilityLoadingWords);
  });
});

describe("set by hand", () => {
  it("lists each player set by hand with his positions, what the feed says and what he is set to", async () => {
    openAvailability();
    const table = within(await panelOf(setByHandTitle)).getByRole("table");
    expectColumnHeads(table, Object.values(availabilityColumns));
    const [saka, watkins] = within(table).getAllByRole("row").slice(1);
    expect(saka.textContent).toBe(`WSaka ARS${AVAILABILITY_WORDS.doubtful}${AVAILABILITY_WORDS.available}`);
    expect(watkins.textContent).toBe(`STWatkins AVL${AVAILABILITY_WORDS.out}${AVAILABILITY_WORDS.doubtful}`);
    expect(within(watkins).getByText(AVAILABILITY_WORDS.out).className).toContain("text-event");
  });

  it("says when nobody is set by hand, and opens no panel", async () => {
    openAvailability({ setByHand: [] });
    expect(await screen.findByText(noneSetByHandWords)).toBeTruthy();
    expect(screen.queryByText(autoTeamReadsWords)).toBeNull();
  });
});

describe("a player's panel", () => {
  it("opens the first set by hand, and a row picked opens his, marked", async () => {
    openAvailability();
    const saka = await panelOf(SAKA.name);
    expect(keyOf(saka, "available").checked).toBe(true);
    expect(within(saka).getByText(feedSaysWords).parentElement?.textContent).toBe(`${feedSaysWords}${AVAILABILITY_WORDS.doubtful}`);
    expect(within(saka).getByText(autoTeamReadsWords)).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: pickPlayerLabel(WATKINS.name) }));
    const watkins = await panelOf(WATKINS.name);
    expect(keyOf(watkins, "doubtful").checked).toBe(true);
    expect(screen.getByRole("button", { name: pickPlayerLabel(WATKINS.name) }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: pickPlayerLabel(WATKINS.name) }).closest("tr")?.className).toContain("shadow-current-edge");
  });

  it("#1209 story 4: the admin finds a player on the feed's and sets him out by hand", async () => {
    const app = openAvailability({ setByHand: [SAKA], players: [SAKA, ISAK], found: [{ code: ISAK.code, name: "Isak", fullName: "Alexander Isak", clubCode: 14, positions: [], unplacedArea: null }] });
    await userEvent.type(await screen.findByRole("searchbox", { name: findLabel }), "Isak");
    await userEvent.click(within(screen.getByRole("list", { name: foundListLabel })).getByRole("button", { name: "Alexander Isak" }));
    const isak = await panelOf(ISAK.name);
    expect(keyOf(isak, FEED_CHOICE).checked).toBe(true);

    await userEvent.click(keyOf(isak, "out"));
    expect(app.admin.setAvailability).toHaveBeenCalledWith(ISAK.code, "out");
  });

  it("The feed gives him back to the feed's", async () => {
    const app = openAvailability();
    await userEvent.click(keyOf(await panelOf(SAKA.name), FEED_CHOICE));
    expect(app.admin.setAvailability).toHaveBeenCalledWith(SAKA.code, null);
  });

  it("shows why a change was refused", async () => {
    const app = openAvailability();
    app.admin.setAvailability.mockResolvedValueOnce(refusals.notAdmin);
    await userEvent.click(keyOf(await panelOf(SAKA.name), "out"));
    expect((await screen.findByRole("alert")).textContent).toBe(refusals.notAdmin);
  });
});
