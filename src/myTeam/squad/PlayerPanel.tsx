import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { slotLabel } from "../../../convex/lineup/roles";
import { playerCardPath } from "../../playerCard/paths";
import { useChange } from "../../shared/useChange";
import { Panel, Problem } from "../../ui/Panel";
import { Placeholder } from "../../ui/Placeholder";
import type { SquadNumberChanges } from "../seam";
import type { Tactics } from "../tactics/seam";
import { SquadNumberBox } from "./SquadNumberBox";
import { NextMatches, PositionList, type Row } from "./SquadTable";
import {
  benchPlaceWords,
  bestRoleNotRatedLabel,
  closeGlyph,
  closePanelLabel,
  figureWords,
  formLabel,
  gameweekRowLong,
  gameweekRowWords,
  lastWords,
  nextGlyph,
  noFigureWords,
  panelPlateWords,
  panelRows,
  playerCardWords,
  roleLastGameweekNotSettledLabel,
  rolePointsNotSettledLabel,
  seasonWords,
  setRoleNotSettledLabel,
  startedNotSettledLabel,
  startingInWords,
  statusNotSettledLabel,
  THIS_SEASON,
} from "./words";

// A player's season panel, on top of the Squad tab's right-hand column once his row is tapped (its
// approved picture, 1440-selected.png): his squad number to change (#13), his season, and the
// placeholders for what isn't held or settled yet (the README's placeholders). The cross closes it.

/** A placeholder in a panel row: the size of a short box. */
const ROW_PLACEHOLDER = "h-5 w-24";

export function PlayerPanel({
  leagueId,
  player,
  tactics,
  numbers,
  onClose,
}: {
  leagueId: Id<"leagues">;
  player: Row;
  tactics: Tactics | undefined;
  numbers: SquadNumberChanges;
  onClose(): void;
}) {
  const change = useChange();
  return (
    <Panel
      title={player.name}
      aside={
        <span className="flex items-center gap-2">
          <span className="text-soft">{panelPlateWords(player.club.shortName, player.number)}</span>
          <button type="button" aria-label={closePanelLabel(player.name)} onClick={onClose} className="min-h-tap min-w-tap text-lead font-bold lg:min-h-0 lg:min-w-0">
            <span aria-hidden="true">{closeGlyph}</span>
          </button>
        </span>
      }
    >
      {player.news !== null && (
        <p className="flex items-center gap-2 px-3 py-1">
          <Placeholder label={statusNotSettledLabel} className="h-5 w-10 shrink-0" />
          <span>{player.news}</span>
        </p>
      )}
      <h3 className="bg-head px-3 font-bold text-ground">{THIS_SEASON}</h3>
      <Problem problem={change.problem} />
      <dl className="grid grid-cols-facts items-center gap-x-4 gap-y-1 px-3 py-2">
        <Fact term={panelRows.number}>
          <SquadNumberBox player={player} change={change} save={(number) => numbers.set(leagueId, player.code, number)} />
        </Fact>
        <Fact term={panelRows.points}>
          <span className="text-muted">{seasonWords}</span> <Figure points={player.seasonPoints} /> <span className="text-muted">{lastWords}</span>{" "}
          <Figure points={player.lastGameweekPoints} />
        </Fact>
        <Fact term={panelRows.form}>
          <span role="list" aria-label={formLabel(player.form.length)} className="flex gap-1">
            {player.form.map((points, index) => (
              <span role="listitem" key={index} className="min-w-6 bg-name-plate px-1 text-center">
                <Figure points={points} />
              </span>
            ))}
          </span>
        </Fact>
        <Fact term={panelRows.started}>
          <Placeholder label={startedNotSettledLabel} className={ROW_PLACEHOLDER} />
        </Fact>
        <Fact term={panelRows.rolePoints}>
          <Placeholder label={rolePointsNotSettledLabel} className={ROW_PLACEHOLDER} />
        </Fact>
        <Fact term={panelRows.plays}>
          <PositionList positions={player.positions} />
        </Fact>
        <Fact term={panelRows.bestRole}>
          <Placeholder label={bestRoleNotRatedLabel} className={ROW_PLACEHOLDER} />
        </Fact>
        <Fact term={panelRows.next}>
          <NextMatches matches={player.nextFixtures} />
        </Fact>
        <Fact term={panelRows.roleLastGameweek}>
          <Placeholder label={roleLastGameweekNotSettledLabel} className={ROW_PLACEHOLDER} />
        </Fact>
        <GameweekPlace tactics={tactics} code={player.code} />
      </dl>
      <div className="flex items-center justify-between gap-2 px-3 pb-2">
        {/* Where Set his role goes isn't settled: a question for Craig (the README). */}
        <Placeholder label={setRoleNotSettledLabel} className="h-tap w-28" />
        <Link to={playerCardPath(leagueId, player.code)} className="flex min-h-tap items-center font-semibold">
          {playerCardWords} <span aria-hidden="true">&nbsp;{nextGlyph}</span>
        </Link>
      </div>
    </Panel>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-soft">{term}</dt>
      <dd>{children}</dd>
    </>
  );
}

function Figure({ points }: { points: number | null }) {
  return points === null ? <span className="text-muted">{noFigureWords}</span> : <span className="font-bold text-figure">{figureWords(points)}</span>;
}

/** Where he stands in the gameweek being set: his slot, or his place on the bench. Nothing while
 *  no lineup is open to set. */
function GameweekPlace({ tactics, code }: { tactics: Tactics | undefined; code: number }) {
  if (tactics?.kind !== "open") return null;
  const { starters, bench } = tactics.lineup;
  const starter = starters.find((each) => each.playerCode === code);
  const benchIndex = bench.indexOf(code);
  const where = starter !== undefined ? startingInWords(slotLabel(starter, starter.role), starter.lane) : benchIndex >= 0 ? benchPlaceWords(benchIndex + 1) : null;
  if (where === null) return null;
  return (
    <>
      <dt className="text-soft">
        <abbr title={gameweekRowLong(tactics.gameweek)} className="no-underline">
          {gameweekRowWords(tactics.gameweek)}
        </abbr>
      </dt>
      <dd>{where}</dd>
    </>
  );
}

