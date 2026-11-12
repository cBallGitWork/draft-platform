import { useState } from "react";
import type { MatchupSide } from "../../convex/matchup/matchupShape";
import { RunsSwitch } from "../myTeam/tactics/TacticsControls";
import { AutoTeamChip } from "../ui/AutoTeamChip";
import { Panel, PanelNote } from "../ui/Panel";
import type { Picking } from "./PlayerTile";
import { SidePitch } from "./SidePitch";
import { averageWords, customFormationWords, leagueAverageWords, LINEUP_TITLE } from "./words";

// One side of a scored matchup (spec/10, The matchup, as a live match), as the approved picture
// draws it: a "Lineup" panel, its team's "Auto team" tag beside the title while nobody runs it,
// then its Runs switch and formation, its pitch and bench; or the league's average.

export type { Picking } from "./PlayerTile";

/** A side's panel, named by its team for screen readers: tapping a man opens his breakdown (#798).
 *  Its pitch's runs show until its own switch hides them, one on each side (spec/05 Runs; Craig,
 *  6 Nov 2026, #850). */
export function SidePanel({ side, picking }: { side: MatchupSide; picking: Picking }) {
  const [runsShown, setRunsShown] = useState(true);
  if (side.kind === "leagueAverage") {
    return (
      <Panel title={leagueAverageWords} namesTeam>
        <PanelNote>{averageWords}</PanelNote>
      </Panel>
    );
  }
  const title = (
    <span className="flex items-center gap-2">
      <span className="sr-only">{side.teamName}</span>
      <span aria-hidden="true">{LINEUP_TITLE}</span>{" "}
      {side.autoTeam && <AutoTeamChip />}
    </span>
  );
  const aside = (
    <span className="flex items-center gap-3">
      <RunsSwitch shown={runsShown} onChange={setRunsShown} />
      <span className="text-derived">{side.formation ?? customFormationWords}</span>
    </span>
  );
  return (
    <Panel title={title} aside={aside}>
      <SidePitch side={side} picking={picking} runsShown={runsShown} />
    </Panel>
  );
}
