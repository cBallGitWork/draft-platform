// Each page names itself in the browser tab (UI-184; spec/12 The frame): the page first, then the
// product, so a row of the app's tabs tells them apart, never "Fantasy Draft Manager" on them all.

import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ADMIN_FEEDS_PATH } from "../../../src/admin/paths";
import { ADMIN_TITLE, feedsTabWords } from "../../../src/admin/words";
import { MAIL_PATH, MY_TEAM_PATH, SCOUTING_PATH, TABLE_PATH } from "../../../src/frame/menu";
import { tabTitle } from "../../../src/frame/words";
import { LEAGUES_PATH } from "../../../src/leagues/paths";
import { LEAGUES_TITLE } from "../../../src/leagues/words";
import { createShellRouter, type ShellContext } from "../../../src/routes/router";
import { SIGN_IN_PATH } from "../../../src/signIn/paths";
import { signInWords } from "../../../src/signIn/words";
import { menuWords } from "../../../src/shared/words";
import type { Session } from "../../../src/signIn/seam";
import { adminSeeing, league, manager, openApp, visitor, withNoPart } from "../../support/src/shell.harness";

describe("UI-184 (S12.14, WCAG 2.4.2 Page Titled): the browser tab", () => {
  it.each<[string, Session, string]>([
    [SIGN_IN_PATH, visitor, signInWords.title],
    [LEAGUES_PATH, manager, LEAGUES_TITLE],
    [MY_TEAM_PATH, manager, menuWords.tactics],
    [TABLE_PATH, manager, menuWords.table],
    [SCOUTING_PATH, manager, menuWords.scouting],
    [MAIL_PATH, manager, menuWords.mail],
    [ADMIN_FEEDS_PATH, adminSeeing(withNoPart(league)), `${feedsTabWords}, ${ADMIN_TITLE}`],
  ])("on %s names the page first", async (path, session, page) => {
    openApp(path, session);
    await waitFor(() => expect(document.title).toBe(tabTitle(page)));
  });

  it("every page's route names it, so no page is left with the product's name alone", () => {
    const router = createShellRouter({} as ShellContext);
    const pages = Object.values(router.routesById).filter((route) => route.options.component !== undefined && "path" in route.options && route.options.path !== undefined);
    expect(pages.length).toBeGreaterThan(20);
    const unnamed = pages.filter((route) => route.options.head === undefined).map((route) => route.fullPath);
    expect(unnamed).toEqual([]);
  });
});
