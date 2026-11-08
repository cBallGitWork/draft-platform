import { cellKey, LANES, sameCell } from "../../convex/lineup/pitch";
import type { MatchupBenchSlot, MatchupSide, MatchupStarter } from "../../convex/matchup/matchupShape";
import { PITCH_ROOM_STYLE } from "../myTeam/tactics/pitch/Pitch";
import { PitchLines } from "../myTeam/tactics/pitch/PitchLines";
import { RoleRuns } from "../myTeam/tactics/pitch/RoleRuns";
import { cellGridOf, ROWS_DRAWN, rowLayoutOf } from "../myTeam/tactics/pitch/rowLayout";
import type { Starter } from "../myTeam/tactics/lineupEdits";
import { figureWords, noFigureWords, notCountingLabel, pitchPlayerLabel, sidePitchLabel, statusText } from "./words";

// A side's pitch on the matchup (spec/10, The matchup, as a live match: "each starter shows his
// slot's position label and his role's run, as on the Tactics pitch"; #850): the Tactics pitch's
// grass, rows and runs, each man at his slot. A sub who came on stands in the slot he came on in,
// with its label and his own role's run, and the man he replaced leaves the pitch (Craig, 6 Nov
// 2026). Read-only: a man is tapped in the lineup under it, which marks him here.

type Team = Extract<MatchupSide, { kind: "team" }>;
/** A man on the pitch: a starter, or a bench player once he has come on. */
type OnPitch = (MatchupStarter | MatchupBenchSlot) & Pick<MatchupStarter, "role" | "place">;

/** Who stands on the pitch: every starter but one subbed off (one no one could replace keeps his
 *  slot, scoring nothing), and every bench player who came on, in his slot. */
function onPitch({ lineup: { starters, bench } }: Team): OnPitch[] {
  const cameOn = bench.filter((slot): slot is OnPitch => slot.role !== null && slot.place !== null);
  return [...starters.filter((starter) => starter.autoSub?.kind !== "off"), ...cameOn];
}

/** A man as the runs read him: his cell and his role. */
const asStarter = ({ playerCode, area, place, role }: OnPitch): Starter => ({ playerCode, area, lane: place.lane, role: role.key });

/** `picked` is the man whose breakdown is open: marked here, and his run the phone's; `runsShown`
 *  is the side's switch. */
export function SidePitch({ side, picked, runsShown }: { side: Team; picked: number | null; runsShown: boolean }) {
  const players = onPitch(side);
  const starters = players.map(asStarter);
  const rows = rowLayoutOf(starters);
  return (
    <div style={PITCH_ROOM_STYLE} className="pitch-room p-2">
      <div className="pitch relative mx-auto">
        <PitchLines rows={rows} />
        <RoleRuns starters={starters} rows={rows} tapped={picked} switchedOn={runsShown} />
        <ul aria-label={sidePitchLabel(side.teamName)} style={cellGridOf(rows)} className="absolute inset-0 grid">
          {ROWS_DRAWN.flatMap((area) =>
            LANES.map((lane) => {
              const cell = { area, lane };
              const at = starters.findIndex((starter) => sameCell(starter, cell));
              if (at === -1) return <li key={cellKey(cell)} aria-hidden="true" />;
              return <PlayerTile key={cellKey(cell)} player={players[at]} picked={picked === players[at].playerCode} />;
            }),
          )}
        </ul>
      </div>
    </div>
  );
}

/** A man's tile: his match's state and his points, his name, then his slot's position label and his
 *  role, as the Tactics pitch names them; greyed while his points don't count, outlined in white
 *  while his breakdown is open (the approved picture). Its words are his, for screen readers. */
function PlayerTile({ player, picked }: { player: OnPitch; picked: boolean }) {
  const { name, role, place, points, counts, status } = player;
  const figure = points === null ? noFigureWords : figureWords(points);
  return (
    <li
      aria-label={`${pitchPlayerLabel(name, place.label, role.name, figure)}${counts ? "" : ` ${notCountingLabel}`}`}
      aria-current={picked || undefined}
      className={`group flex min-w-0 items-center justify-center ${counts ? "" : "text-muted"}`}
    >
      <span aria-hidden="true" className="flex max-w-full flex-col items-center bg-name-plate p-0.5 group-aria-current:outline-2 group-aria-current:outline-solid group-aria-current:outline-fact">
        <span className="flex w-full justify-between gap-1 text-data">
          <span>{statusText(status)}</span>
          <span className={counts && points !== null ? "font-bold text-figure" : ""}>{figure}</span>
        </span>
        <span className={`max-w-full truncate font-semibold ${counts ? "text-lead" : ""}`}>{name}</span>
        <span className={`line-clamp-2 max-w-full text-center text-data max-lg:leading-pitch-role ${counts ? "text-soft" : ""}`}>
          <span data-slot-label>{place.label}</span> {role.name}
        </span>
      </span>
    </li>
  );
}
