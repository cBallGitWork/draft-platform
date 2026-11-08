import { cellKey, LANES, sameCell } from "../../convex/lineup/pitch";
import type { MatchupBenchSlot, MatchupSide, MatchupStarter } from "../../convex/matchup/matchupShape";
import { PITCH_ROOM_STYLE } from "../myTeam/tactics/pitch/Pitch";
import { PitchLines } from "../myTeam/tactics/pitch/PitchLines";
import { RoleRuns } from "../myTeam/tactics/pitch/RoleRuns";
import { cellGridOf, ROWS_DRAWN, rowLayoutOf } from "../myTeam/tactics/pitch/rowLayout";
import type { Starter } from "../myTeam/tactics/lineupEdits";
import { PlayerTile, type Picking, type TileMan } from "./PlayerTile";
import { benchLabel, BENCH_TITLE, sidePitchLabel } from "./words";

// A side's pitch on the matchup (spec/10, The matchup, as a live match: "each starter shows his
// slot's position label and his role's run, as on the Tactics pitch"; #850), as the approved
// picture draws it: the Tactics pitch's grass, rows and runs, each man's tile at his slot. A sub
// who came on stands in the slot he came on in, with its label and his own role's run, and the man
// he replaced leaves the pitch for the bench (Craig, 6 Nov 2026). Under it the bench, a row of
// tiles in bench order.

export type TeamSide = Extract<MatchupSide, { kind: "team" }>;
/** A man on the pitch: a starter, or a bench player once he has come on. */
export type OnPitch = (MatchupStarter | MatchupBenchSlot) & Pick<MatchupStarter, "role" | "place">;

/** Who stands on the pitch: every starter but one subbed off (one no one could replace keeps his
 *  slot, scoring nothing), and every bench player who came on, in his slot. */
export function onPitch({ lineup: { starters, bench } }: TeamSide): OnPitch[] {
  const cameOn = bench.filter((slot): slot is OnPitch => slot.role !== null && slot.place !== null);
  return [...starters.filter((starter) => starter.autoSub?.kind !== "off"), ...cameOn];
}

/** The bench row, in bench order: each bench player not on, and in a sub's place the starter he
 *  came on for, "Off" (the approved picture). */
function offPitch({ lineup: { starters, bench } }: TeamSide): TileMan[] {
  return bench.map((slot) => {
    if (slot.autoSub?.kind !== "on") return slot;
    const { playerName } = slot.autoSub;
    return starters.find((starter) => starter.autoSub?.kind === "off" && starter.name === playerName) ?? slot;
  });
}

/** A man as the runs read him: his cell and his role. */
const asStarter = ({ playerCode, area, place, role }: OnPitch): Starter => ({ playerCode, area, lane: place.lane, role: role.key });

/** `picking` is whose breakdown is open, marked here, his run the phone's; `runsShown` is the
 *  side's switch. */
export function SidePitch({ side, picking, runsShown }: { side: TeamSide; picking: Picking; runsShown: boolean }) {
  const players = onPitch(side);
  const starters = players.map(asStarter);
  const rows = rowLayoutOf(starters);
  return (
    <>
      <div style={PITCH_ROOM_STYLE} className="pitch-room-full p-2">
        <div className="pitch relative mx-auto">
          <PitchLines rows={rows} />
          <RoleRuns starters={starters} rows={rows} tapped={picking.picked} switchedOn={runsShown} />
          <ul aria-label={sidePitchLabel(side.teamName)} style={cellGridOf(rows)} className="absolute inset-0 grid">
            {ROWS_DRAWN.flatMap((area) =>
              LANES.map((lane) => {
                const cell = { area, lane };
                const at = starters.findIndex((starter) => sameCell(starter, cell));
                if (at === -1) return <li key={cellKey(cell)} aria-hidden="true" />;
                return <PlayerTile key={cellKey(cell)} man={players[at]} picking={picking} strip className="items-center justify-center p-0.5" />;
              }),
            )}
          </ul>
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-panel-rule px-2 py-1">
        <h3 className="w-12 shrink-0 font-bold">{BENCH_TITLE}</h3>
        <ul aria-label={benchLabel(side.teamName)} className="flex min-w-0 grow justify-end gap-1">
          {offPitch(side).map((man) => (
            <PlayerTile key={man.playerCode} man={man} picking={picking} strip={false} className="w-tile" />
          ))}
        </ul>
      </div>
    </>
  );
}
