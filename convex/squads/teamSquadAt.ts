import { answerAt } from "../gameweeks/hourAnswers";
import { NEXT_MATCHES_SHOWN, SCHEDULE_GAMEWEEKS } from "./squadLimits";
import type { HeldTeamSquad, TeamSquad } from "./teamSquad";

// My team's squad at its minute (#2008). teamSquad.ts's `ofMyTeam` takes the hour, never the
// minute, and sends every match a minute of it may show; what moves with the clock, each club's
// next matches and the Schedule view's gameweeks from the one being set, is kept to the minute's
// here. Pure, so the screen and the tests alike.

/** The squad at `now`, from what `ofMyTeam` sent for an hour; undefined outside that hour, as for
 *  an earlier hour's answer held while `now`'s loads. */
export function teamSquadAt({ scheduleFrom, ...squad }: HeldTeamSquad, now: number): TeamSquad | undefined {
  const save = answerAt(scheduleFrom, now);
  if (save === undefined) return undefined;
  const from = save.gameweek;
  const scheduleGameweeks = from === null ? [] : squad.scheduleGameweeks.filter((gameweek) => gameweek >= from).slice(0, SCHEDULE_GAMEWEEKS);
  const shown = new Set(scheduleGameweeks);
  return {
    ...squad,
    scheduleGameweeks,
    players: squad.players.map((row) => ({
      ...row,
      nextFixtures: row.nextFixtures.filter(({ kickoff }) => kickoff > now).slice(0, NEXT_MATCHES_SHOWN),
      schedule: row.schedule.filter(({ gameweek }) => shown.has(gameweek)),
    })),
  };
}
