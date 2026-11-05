import { useMemo, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type { ListedPlayer } from "../scouting/seam";
import { pickInRoundOf } from "./board";
import type { OnTheClock } from "./ClockLeft";
import { DraftPlayers, type WhyNot } from "./DraftPlayers";
import { PickPanel, type YourSquad, type YourTurn } from "./PickPanel";
import type { DraftBoard, DraftSeam, DraftState, RoomFigures } from "./seam";
import { slotWords } from "./words";

// Under the board (the approved draft room picture; #1099): the players list, and beside it the
// right-hand column, the selected player's panel on top, where the reader makes his pick while he
// is on the clock. The column keeps its width with no player selected, so the list doesn't move;
// its queue, auto-pick and commissioner widgets are #1100's and #1101's.

/** Where the reader's pick stands in the draft. */
function yourTurn(draft: DraftState, board: DraftBoard, onTheClock: OnTheClock | null): YourTurn {
  if (draft.status !== "live" || onTheClock === null) return { kind: "notStarted" };
  if (draft.clock?.pausedAt !== undefined) return { kind: "paused" };
  if (board.yourTeamId === null || draft.onTheClock.teamId !== board.yourTeamId) return { kind: "notYours" };
  return { kind: "yours", slot: slotWords(draft.onTheClock.round, pickInRoundOf(draft.onTheClock.pick, draft.order.length)), onTheClock };
}

/** How many players of `player`'s main position and of his club the reader's picks so far hold. */
function yourSquad(board: DraftBoard, player: ListedPlayer, figures: RoomFigures | undefined): YourSquad {
  if (board.yourTeamId === null) return null;
  const yours = board.picks.flatMap(({ teamId, player: picked }) => (teamId === board.yourTeamId && picked !== null ? [picked] : []));
  return {
    atPosition: yours.filter(({ position }) => position === player.positions[0]).length,
    atClub: yours.filter(({ clubShortName }) => clubShortName === player.club.shortName).length,
    maxPerClub: figures?.maxPerClub ?? null,
  };
}

export function PickRoom({
  leagueId,
  seam,
  draft,
  board,
  onTheClock,
  now,
}: {
  leagueId: Id<"leagues">;
  seam: DraftSeam;
  draft: DraftState;
  board: DraftBoard;
  onTheClock: OnTheClock | null;
  now: number;
}) {
  const greyed = seam.useGreyedOut(leagueId);
  const figures = seam.useFigures(leagueId, now);
  const lists = seam.useLists(leagueId);
  const changes = seam.useDraftChanges();
  const [selected, setSelected] = useState<ListedPlayer | null>(null);
  const whyNot: WhyNot = useMemo(() => new Map((greyed ?? []).map(({ code, reason }) => [code, reason])), [greyed]);
  const queue = useMemo(() => (lists?.queue ?? []).map(({ code }) => code), [lists]);
  const figureOf = useMemo(() => new Map((figures?.players ?? []).map((figure) => [figure.code, figure])), [figures]);
  return (
    <div className="flex flex-wrap items-start gap-2">
      <DraftPlayers
        leagueId={leagueId}
        usePlayersList={seam.usePlayersList}
        figures={figures}
        whyNot={whyNot}
        queue={queue}
        selected={selected}
        select={setSelected}
      />
      <div className="flex min-w-0 grow basis-draft-widgets flex-col gap-2 lg:shrink-0 lg:grow-0">
        {selected !== null && (
          <PickPanel
            key={selected.code}
            leagueId={leagueId}
            player={selected}
            figure={figureOf.get(selected.code) ?? null}
            lastSeason={figures?.lastSeason ?? null}
            statsSeason={figures?.statsSeason ?? null}
            squad={yourSquad(board, selected, figures)}
            whyNot={whyNot.get(selected.code)}
            turn={yourTurn(draft, board, onTheClock)}
            changes={changes}
            close={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  );
}
