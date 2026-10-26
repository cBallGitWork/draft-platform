// My team's tabs in the preview (src/preview.ts): the preview manager's team in the table
// preview's league, so the Fixtures tab and the table and fixtures screen show the same draw.

import { teamFixturesOf } from "../table/drawnTable";
import { previewSeason, previewTeams } from "../table/preview";
import { previewTactics } from "./previewTactics";
import type { MyTeamSeam } from "./seam";

const [previewTeam] = previewTeams;
const fixtures = teamFixturesOf(previewTeams, previewTeam, previewSeason);

export const previewMyTeam: MyTeamSeam = { ...previewTactics, useTeamFixtures: () => fixtures };
