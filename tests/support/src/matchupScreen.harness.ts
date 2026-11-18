// The matchup's tests' opener (tests/src/matchup/*.test.tsx): the app at the matchup, for the
// manager, with the fake seam's data (matchup.harness.ts).

import { MATCHUP_PATH } from "../../../src/frame/menu";
import { openBreakdownLabel } from "../../../src/matchup/words";
import type { MatchupData } from "./matchup.harness";
import { manager, openApp } from "./shell.harness";

/** A man's tile on the matchup, by the name its button ends with after the words it shows
 *  (`tileButtonLabel`): the button that opens his breakdown. */
export const tileOf = (name: string) => (label: string) => label.endsWith(`, ${openBreakdownLabel(name)}`);

export const openMatchup = (matchup: MatchupData = {}, path = MATCHUP_PATH) => openApp(path, manager, { matchup });
