// League home's tests' opener (tests/src/home/*.test.tsx): the app at League home, for the
// manager, with the fake seam's data (home.harness.ts).

import { HOME_PATH } from "../../../src/frame/menu";
import type { LeagueHome } from "../../../src/home/seam";
import { quietHome, type HomeData } from "./home.harness";
import { manager, openApp } from "./shell.harness";

export const openHome = (home: HomeData = {}) => openApp(HOME_PATH, manager, { home });
/** League home as a quiet one, changed as `change` says. */
export const withHome = (change: Partial<LeagueHome>, rest: HomeData = {}) => openHome({ ...rest, leagueHome: { ...quietHome, ...change } });
