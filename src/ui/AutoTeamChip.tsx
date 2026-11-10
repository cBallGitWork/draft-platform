import { autoTeamWhatWords, autoTeamWords } from "../shared/words";

// A team on the auto team (spec/09: "the table and the matchup mark a team on the auto team"): the
// event-coloured Auto team chip after its name, its hover saying what the auto team does (the
// approved table picture's interaction notes).

export function AutoTeamChip() {
  return (
    <span title={autoTeamWhatWords} className="bg-event px-1 text-data font-normal text-ground">
      {autoTeamWords}
    </span>
  );
}
