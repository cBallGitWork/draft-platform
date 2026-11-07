import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { positionOfSlot } from "../../../convex/lineup/pitch";
import { playerCardPath } from "../../playerCard/paths";
import { useChange } from "../../shared/useChange";
import { Panel, Problem } from "../../ui/Panel";
import { Placeholder } from "../../ui/Placeholder";
import type { SquadNumberChanges } from "../seam";
import { StarRating } from "../../ui/StarRating";
import { starsIn } from "../../../convex/stars/bestRole";
import { benchBestRole } from "../tactics/lineupDraft";
import { ROLE_FIT_SUBJECT } from "../tactics/words";
import type { Tactics } from "../tactics/seam";
import { SquadNumberBox } from "./SquadNumberBox";
import { PositionCodes } from "../../ui/PositionCodes";
import { NextMatches } from "../SquadCells";
import type { Row } from "./SquadTable";
import {
  benchedInWords,
  bestRoleNotRatedLabel,
  closeGlyph,
  closePanelLabel,
  figureWords,
  formLabel,
  gameweekWords,
  gameweekRowWords,
  lastWords,
  nextGlyph,
  noFigureWords,
  panelPlateWords,
  panelRows,
  playerCardWords,
  roleLastGameweekNotSettledLabel,
  rolePointsNotBuiltLabel,
  seasonWords,
  setRoleNotBuiltLabel,
  startedNotBuiltLabel,
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
      {/* His doubt line: the chip where FPL holds a doubt, as his row has it, and FPL's news. */}
      {(player.chanceOfPlaying !== null || player.news !== null) && (
        <p className="flex items-center gap-2 px-3 py-1">
          {player.chanceOfPlaying !== null && <Placeholder label={statusNotSettledLabel} className="h-5 w-10 shrink-0" />}
          {player.news !== null && <span>{player.news}</span>}
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
          <Placeholder label={startedNotBuiltLabel} className={ROW_PLACEHOLDER} />
        </Fact>
        <Fact term={panelRows.rolePoints}>
          <Placeholder label={rolePointsNotBuiltLabel} className={ROW_PLACEHOLDER} />
        </Fact>
        <Fact term={panelRows.plays}>
          <PositionCodes positions={player.positions} spaced />
        </Fact>
        <Fact term={panelRows.bestRole}>
          <BestRole tactics={tactics} code={player.code} />
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
        {/* Set his role opens Tactics with him selected (the README), once Tactics can from the address. */}
        <Placeholder label={setRoleNotBuiltLabel} className="h-tap w-28" />
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

/** The role he has the most stars for at his main position's slot, with his stars for it, as the
 *  Tactics bench's Best role (spec/05 Roles). His stars come with the lineup being set, so with
 *  none open to set (the season over) it stays the placeholder. */
function BestRole({ tactics, code }: { tactics: Tactics | undefined; code: number }) {
  const member = tactics?.kind === "open" ? tactics.squad.find((each) => each.playerCode === code) : undefined;
  const best = member === undefined ? undefined : benchBestRole(member);
  if (member === undefined || best === undefined) return <Placeholder label={bestRoleNotRatedLabel} className={ROW_PLACEHOLDER} />;
  return (
    <span className="flex items-center gap-2">
      {best.role.name}
      <StarRating stars={starsIn(best.cell, best.role.key, member.stars)} subject={ROLE_FIT_SUBJECT} />
    </span>
  );
}

/** Where he stands in the gameweek being set: his slot, or his place on the bench. Nothing while
 *  no lineup is open to set. */
function GameweekPlace({ tactics, code }: { tactics: Tactics | undefined; code: number }) {
  if (tactics?.kind !== "open") return null;
  const { starters, bench } = tactics.lineup;
  const starter = starters.find((each) => each.playerCode === code);
  const benchIndex = bench.indexOf(code);
  const where = starter !== undefined ? startingInWords(positionOfSlot(starter), starter.lane) : benchIndex >= 0 ? benchedInWords(benchIndex + 1) : null;
  if (where === null) return null;
  return (
    <>
      <dt className="text-soft">
        <abbr title={gameweekWords(tactics.gameweek)} className="no-underline">
          {gameweekRowWords(tactics.gameweek)}
        </abbr>
      </dt>
      <dd>{where}</dd>
    </>
  );
}

