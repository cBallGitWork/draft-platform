import { Link } from "@tanstack/react-router";
import { AREAS, cellKey, LANES, sameCell } from "../../../convex/lineup/pitch";
import { MY_TEAM_PATH } from "../../frame/menu";
import { Panel, PanelNote } from "../../ui/Panel";
import { PitchLines } from "../tactics/pitch/PitchLines";
import { CELL_GRID, Shirt } from "../tactics/pitch/Pitch";
import { PITCH_ASPECT } from "../tactics/pitch/pitchMarkings";
import type { OpenTactics, Tactics } from "../tactics/seam";
import { Placeholder } from "../../ui/Placeholder";
import type { Row } from "./SquadTable";
import {
  benchShort,
  elevenAsideWords,
  elevenBenchLabel,
  elevenPitchLabel,
  elevenPlayerLabel,
  figureWords,
  nextGlyph,
  noFigureWords,
  noLineupWords,
  setLineupWords,
  statusNotSettledLabel,
  YOUR_ELEVEN_TITLE,
} from "./words";

// The Squad tab's Your eleven (its approved picture): the lineup being set for the next gameweek,
// read-only, each player with his season points, the bench in order under it, and Set lineup to the
// Tactics tab, where it is set.

/** Top to bottom as the pitch is drawn: attack first, as on the Tactics tab. */
const ROWS_DRAWN = AREAS.toReversed();

/** The preset the eleven stand in, if their cells are exactly one of the league's presets'. */
export function formationOf({ lineup: { starters }, presets }: Pick<OpenTactics, "lineup" | "presets">): string | null {
  const preset = presets.find(({ cells }) => cells.length === starters.length && cells.every((cell) => starters.some((starter) => sameCell(starter, cell))));
  return preset?.name ?? null;
}

/** `players` are the squad's rows by code, for each one's season points; `selected` is the player
 *  whose panel is open, his tile outlined in white. */
export function YourEleven({ tactics, players, selected }: { tactics: Tactics | undefined; players: ReadonlyMap<number, Row>; selected: number | null }) {
  const open = tactics?.kind === "open" ? tactics : null;
  const formation = open === null ? null : formationOf(open);
  return (
    <Panel title={YOUR_ELEVEN_TITLE} aside={<span className="text-soft">{formation === null ? elevenAsideWords : `${formation}, ${elevenAsideWords}`}</span>}>
      {tactics === undefined ? null : open === null ? (
        <PanelNote>{noLineupWords}</PanelNote>
      ) : (
        <div className="flex flex-col gap-2 p-2">
          <ElevenPitch tactics={open} players={players} selected={selected} />
          <ElevenBench tactics={open} players={players} />
        </div>
      )}
      <div className="px-2 pb-2">
        <Link to={MY_TEAM_PATH} className="action justify-center">
          {setLineupWords} <span aria-hidden="true">&nbsp;{nextGlyph}</span>
        </Link>
      </div>
    </Panel>
  );
}

function ElevenPitch({ tactics, players, selected }: { tactics: OpenTactics; players: ReadonlyMap<number, Row>; selected: number | null }) {
  const members = new Map(tactics.squad.map((member) => [member.playerCode, member]));
  return (
    <div style={{ aspectRatio: PITCH_ASPECT }} className="relative w-full border-2 border-pitch-line">
      <PitchLines />
      <ul aria-label={elevenPitchLabel} style={CELL_GRID} className="absolute inset-0 grid">
      {ROWS_DRAWN.flatMap((area) =>
        LANES.map((lane) => {
          const cell = { area, lane };
          const starter = tactics.lineup.starters.find((each) => sameCell(each, cell));
          const member = starter === undefined ? undefined : members.get(starter.playerCode);
          if (starter === undefined || member === undefined) return <li key={cellKey(cell)} aria-hidden="true" />;
          const points = pointsOf(players, starter.playerCode);
          return (
            <li
              key={cellKey(cell)}
              aria-label={elevenPlayerLabel(member.name, points)}
              aria-current={selected === starter.playerCode || undefined}
              className="group flex min-w-0 items-center justify-center"
            >
              {/* His tile: the shirt over the name plate, outlined in white while his panel is open
                  (the approved picture), his status mark at its corner. */}
              <span className="relative flex max-w-full flex-col items-center p-0.5 group-aria-current:outline-2 group-aria-current:outline-solid group-aria-current:outline-fact">
                <Shirt number={member.number} clubCode={member.clubCode} goalkeeper={area === "goalkeeper"} />
                <span aria-hidden="true" className="flex max-w-full flex-col items-center bg-name-plate px-1">
                  <span className="max-w-full truncate font-semibold">{member.name}</span>
                  <span className="font-bold text-figure">{points}</span>
                </span>
                <StatusMark player={players.get(starter.playerCode)} className="absolute top-0 right-0" />
              </span>
            </li>
          );
        }),
      )}
      </ul>
    </div>
  );
}

function ElevenBench({ tactics, players }: { tactics: OpenTactics; players: ReadonlyMap<number, Row> }) {
  const members = new Map(tactics.squad.map((member) => [member.playerCode, member]));
  return (
    <ol aria-label={elevenBenchLabel} className="grid grid-cols-5 gap-px">
      {tactics.lineup.bench.map((code, index) => {
        const name = members.get(code)?.name ?? "";
        const points = pointsOf(players, code);
        return (
          <li key={code} aria-label={elevenPlayerLabel(name, points)} className="min-w-0 bg-name-plate px-1">
            <span className="flex items-center justify-between">
              <span aria-hidden="true" className="text-muted">
                {benchShort(index + 1)}
              </span>
              <StatusMark player={players.get(code)} />
            </span>
            <span aria-hidden="true" className="block truncate font-semibold">
              {name}
            </span>
            <span aria-hidden="true" className="block font-bold text-figure">
              {points}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** The status chip's placeholder for a player FPL holds a doubt about, as his row has it. */
function StatusMark({ player, className = "" }: { player: Row | undefined; className?: string }) {
  if (player === undefined || player.chanceOfPlaying === null) return null;
  return <Placeholder label={statusNotSettledLabel} className={`size-3 bg-name-plate ${className}`} />;
}

/** His season points as the table shows them, "—" while none is priced. */
const pointsOf = (players: ReadonlyMap<number, Row>, code: number) => {
  const points = players.get(code)?.seasonPoints ?? null;
  return points === null ? noFigureWords : figureWords(points);
};
