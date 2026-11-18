import { Link } from "@tanstack/react-router";
import type { Id } from "../../convex/_generated/dataModel";
import { PREMIER_LEAGUE_PATH } from "../frame/menu";
import { playerCardPath } from "../playerCard/paths";
import { MatchState } from "../premierLeague/MatchState";
import { matchPath } from "../premierLeague/paths";
import { goalsWords } from "../premierLeague/words";
import { PanelNote } from "../ui/Panel";
import { FoldingPanel } from "./FoldingPanel";
import { PanelLink } from "./PanelLink";
import type { LeagueHome } from "./seam";
import {
  allFixturesLink,
  listSeparator,
  matchListLabel,
  noMatchesWords,
  noSquadNewsWords,
  premierLeagueTitle,
  SQUAD_NEWS_TITLE,
  themWords,
  versusWords,
  weekdayTimeWords,
  youWords,
} from "./words";

type Yours = NonNullable<LeagueHome["yours"]>;

// League home's right-hand panels on the reader's own players (Craig, 13 Nov 2026, on #1976).

/** This gameweek's matches with one of his players or his opponent's, by kickoff, each naming
 *  them; a match opens its page, All fixtures the Premier League. */
export function PremierLeaguePanel({ gameweek, matches }: { gameweek: number; matches: Yours["premierLeague"] }) {
  return (
    <FoldingPanel title={premierLeagueTitle(gameweek)}>
      {matches.length === 0 ? (
        <PanelNote>{noMatchesWords}</PanelNote>
      ) : (
        <ul aria-label={matchListLabel(gameweek)}>
          {matches.map((match) => (
            <li key={match.fixtureCode} className="flex flex-col border-b border-panel-rule px-3 py-2">
              <MatchLine match={match} />

              <Side label={youWords} names={match.you} />
              <Side label={themWords} names={match.them} />
            </li>
          ))}
        </ul>
      )}
      <PanelLink to={PREMIER_LEAGUE_PATH}>{allFixturesLink}</PanelLink>
    </FoldingPanel>
  );
}

/** The match's clubs and, once it kicks off, its score and where it stands: the clock, half-time
 *  or full time (S12.23); before then "v" and its kickoff's day and time. */
function MatchLine({ match: { fixtureCode, kickoff, home, away, score } }: { match: Yours["premierLeague"][number] }) {
  const goals = goalsWords(score);
  return (
    <span className="flex justify-between gap-3">
      <Link to={matchPath(fixtureCode)} className="inline-flex min-h-tap items-center font-semibold lg:min-h-0">
        {home.shortName} {goals === null ? versusWords : <span className="font-bold text-figure">{goals}</span>} {away.shortName}
      </Link>
      {goals !== null ? (
        <MatchState kickoff={kickoff} score={score} long={false} />
      ) : (
        kickoff !== null && <span className="text-soft">{weekdayTimeWords(kickoff)}</span>
      )}
    </span>
  );
}

function Side({ label, names }: { label: string; names: readonly string[] }) {
  if (names.length === 0) return null;
  return (
    <span>
      <span className="text-soft">{label}</span> {names.join(listSeparator)}
    </span>
  );
}

/** Each of his squad's players FPL gives a news note, the note word for word and no chip; a name
 *  opens his card. */
export function SquadNewsPanel({ leagueId, news }: { leagueId: Id<"leagues">; news: Yours["squadNews"] }) {
  return (
    <FoldingPanel title={SQUAD_NEWS_TITLE}>
      {news.length === 0 ? (
        <PanelNote>{noSquadNewsWords}</PanelNote>
      ) : (
        <ul>
          {news.map((player) => (
            <li key={player.playerCode} className="flex gap-3 border-b border-panel-rule px-3 py-2">
              <Link to={playerCardPath(leagueId, player.playerCode)} className="inline-flex min-h-tap w-24 shrink-0 items-center font-semibold lg:min-h-0">
                {player.name}
              </Link>
              <span>{player.news}</span>
            </li>
          ))}
        </ul>
      )}
    </FoldingPanel>
  );
}
