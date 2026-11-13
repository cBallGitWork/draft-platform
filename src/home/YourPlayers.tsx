import { Link } from "@tanstack/react-router";
import type { Id } from "../../convex/_generated/dataModel";
import { PREMIER_LEAGUE_PATH } from "../frame/menu";
import { playerCardPath } from "../playerCard/paths";
import { matchPath } from "../premierLeague/paths";
import { PanelNote } from "../ui/Panel";
import { FoldingPanel } from "./FoldingPanel";
import { PanelLink } from "./PanelLink";
import type { LeagueHome } from "./seam";
import {
  allFixturesLink,
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
              <span className="flex justify-between gap-3">
                <Link to={matchPath(match.fixtureCode)} className="font-semibold">
                  {match.home.shortName} {versusWords} {match.away.shortName}
                </Link>
                {match.kickoff !== null && <span className="text-soft">{weekdayTimeWords(match.kickoff)}</span>}
              </span>
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

function Side({ label, names }: { label: string; names: readonly string[] }) {
  if (names.length === 0) return null;
  return (
    <span>
      <span className="text-soft">{label}</span> {names.join(", ")}
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
              <Link to={playerCardPath(leagueId, player.playerCode)} className="w-24 shrink-0 font-semibold">
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
