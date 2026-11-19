import { autoTeamWords, awayModeHoverWords } from "../shared/words";

// A team on the auto team (spec/09: "the table and the matchup mark a team on the auto team"): the
// event-coloured Away chip after its name, its hover saying in one line what Away mode does (the
// approved table picture's interaction notes; Craig, 18 Nov 2026).

export function AutoTeamChip() {
  return (
    <span title={awayModeHoverWords} className="bg-event px-1 text-data font-normal text-ground">
      {autoTeamWords}
    </span>
  );
}
