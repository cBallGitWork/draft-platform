import { useState, type ReactNode } from "react";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import type { MatchupSide } from "../../convex/matchup/matchupShape";
import { runs } from "../leagues/access";
import { PlayerBreakdown } from "./PlayerBreakdown";
import { TeamOverrides } from "./TeamOverride";
import { Loading, PageSection, PanelNote } from "../ui/Panel";
import { useLastLoaded } from "../shared/useLastLoaded";
import { useMinute } from "../shared/useMinute";
import { Fixture, GameSwitch, ScoredHead, Stepper, type HeadToHead } from "./MatchupHead";
import { SidePanel } from "./SidePanel";
import { Vidiprinter } from "./Vidiprinter";
import type { MatchupAsked, MatchupSeam } from "./seam";
import {
  byeWords,
  loadingWords,
  MATCHUP_TITLE,
  noCommentaryWords,
  noGamesWords,
  noGameWords,
  notBegunWords,
  noTeamWords,
  sideName,
  totalPointsWords,
  unscoredWords,
  VIDIPRINTER_TITLE,
} from "./words";

type Scored = Extract<HeadToHead["game"], { kind: "scored" }>;

/** The matchup (spec/10, The matchup, as a live match; spec/12): one head-to-head in one gameweek,
 *  laid out as its approved picture: the head with the totals, then each side's pitch flanking a
 *  centre column, which holds the vidiprinter and, once a man is tapped, his breakdown at its top.
 *  Live until every match is final. A manager lands on My team (spec/12); this is a tab away, and
 *  any fixture links here. */
export function MatchupPage({ league, seam, asked }: { league: LeagueSummary; seam: MatchupSeam; asked: MatchupAsked }) {
  // The minute is in the query's arguments, and a live matchup mustn't blank every minute; another
  // matchup asked for loads afresh.
  const matchup = useLastLoaded(seam.useMatchup(league.leagueId, useMinute(), asked), `${asked.teamId}/${asked.gameweek}/${asked.game}`);
  return (
    // No title plate: the approved picture's score band sits straight under the top bar.
    <PageSection title={MATCHUP_TITLE} plate={false} className="flex flex-col gap-2">
      {matchup === undefined ? (
        <Loading>{loadingWords}</Loading>
      ) : matchup.kind === "totalPoints" ? (
        <p className="text-muted">{totalPointsWords}</p>
      ) : matchup.kind === "noTeam" ? (
        <p className="text-muted">{noTeamWords}</p>
      ) : (
        <HeadToHeadMatchup league={league} seam={seam} matchup={matchup} />
      )}
    </PageSection>
  );
}

function HeadToHeadMatchup({ league, seam, matchup }: { league: LeagueSummary; seam: MatchupSeam; matchup: HeadToHead }) {
  const { teamName, gameweek, deadline, game } = matchup;
  if (gameweek === null) return <p className="text-muted">{noGamesWords(teamName)}</p>;
  const gameSwitch = <GameSwitch matchup={matchup} gameweek={gameweek} />;
  const stepper = <Stepper matchup={matchup} gameweek={gameweek} />;
  if (game.kind === "scored") {
    // Whoever runs the league overrides a team's total under its name (spec/14 S14.6; #903).
    const overrides = runs(league)
      ? (layout: (controlOf: (side: MatchupSide) => ReactNode) => ReactNode) => (
          <TeamOverrides leagueId={league.leagueId} gameweek={gameweek} seam={seam} layout={layout} />
        )
      : null;
    return <ScoredMatchup leagueId={league.leagueId} game={game} stepper={stepper} gameSwitch={gameSwitch} overrides={overrides} />;
  }
  return (
    <>
      {stepper}
      <div className="bg-panel">
        {game.kind === "none" ? (
          <PanelNote>{noGameWords(teamName, gameweek)}</PanelNote>
        ) : game.kind === "bye" ? (
          <>
            {gameSwitch}
            <PanelNote>{byeWords(teamName)}</PanelNote>
          </>
        ) : (
          <>
            <Fixture teamName={teamName} opponent={sideName(game.opponent)} />
            {gameSwitch}
            <PanelNote>{game.kind === "notBegun" ? notBegunWords(deadline) : unscoredWords(game.reason)}</PanelNote>
          </>
        )}
      </div>
    </>
  );
}

/** The man whose breakdown is open and his side's name, found afresh in each side as the live
 *  matchup moves; none once neither side holds him (another gameweek's matchup, say). */
function pickedMan(sides: readonly MatchupSide[], picked: number | null) {
  for (const side of sides) {
    if (side.kind !== "team") continue;
    const found = [...side.lineup.starters, ...side.lineup.bench].find((slot) => slot.playerCode === picked);
    if (found !== undefined) return { slot: found, teamName: sideName(side) };
  }
  return undefined;
}

function ScoredMatchup({
  leagueId,
  game: { team, opponent, commentary, version },
  stepper,
  gameSwitch,
  overrides,
}: {
  leagueId: string;
  game: Scored;
  stepper: ReactNode;
  gameSwitch: ReactNode;
  overrides: Parameters<typeof ScoredHead>[0]["overrides"];
}) {
  const [picked, setPicked] = useState<number | null>(null);
  // Tapping the man whose breakdown is open closes it.
  const picking = { picked, pick: (playerCode: number) => setPicked((current) => (current === playerCode ? null : playerCode)) };
  const open = pickedMan([team, opponent], picked);
  return (
    <>
      <ScoredHead stepper={stepper} team={team} opponent={opponent} gameSwitch={gameSwitch} overrides={overrides} />
      <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-3">
        <SidePanel side={team} picking={picking} />
        <div className="flex min-w-0 flex-col gap-2">
          {open !== undefined && <PlayerBreakdown leagueId={leagueId} slot={open.slot} teamName={open.teamName} version={version} close={() => setPicked(null)} />}
          <Vidiprinter
            commentary={commentary}
            title={VIDIPRINTER_TITLE}
            noLinesWords={noCommentaryWords}
            // A column for each team, the league's average having none (readCommentary.ts).
            teams={{
              names: [team, opponent].flatMap((side) => (side.kind === "team" ? [side.teamName] : [])),
              marked: open === undefined ? null : { playerCode: open.slot.playerCode, name: open.slot.name },
            }}
          />
        </div>
        <SidePanel side={opponent} picking={picking} />
      </div>
    </>
  );
}
