// The Premier League section's tests' opener (tests/src/premierLeague/*.test.tsx): the app at the
// section, for the manager, with the fake seam's data (premierLeague.harness.ts).

import { PREMIER_LEAGUE_PATH } from "../../../src/frame/menu";
import type { PremierLeagueData } from "./premierLeague.harness";
import { manager, openApp } from "./shell.harness";

export const openSection = (premierLeague: PremierLeagueData = {}) => openApp(PREMIER_LEAGUE_PATH, manager, { premierLeague });
