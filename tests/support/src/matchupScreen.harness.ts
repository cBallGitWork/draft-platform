// The matchup's tests' opener (tests/src/matchup/*.test.tsx): the app at the matchup, for the
// manager, with the fake seam's data (matchup.harness.ts).

import { MATCHUP_PATH } from "../../../src/frame/menu";
import type { MatchupData } from "./matchup.harness";
import { manager, openApp } from "./shell.harness";

export const openMatchup = (matchup: MatchupData = {}, path = MATCHUP_PATH) => openApp(path, manager, { matchup });
