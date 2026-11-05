import { useMemo, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type { ListedPlayer } from "../scouting/seam";
import { pickInRoundOf } from "./board";
import type { OnTheClock } from "./ClockLeft";
import { DraftPlayers, type WhyNot } from "./DraftPlayers";
import { PickPanel, type YourTurn } from "./PickPanel";
import type { DraftBoard, DraftSeam, DraftState } from "./seam";
import { slotWords } from "./words";

// Under the board (the approved draft room picture; #1099): the players list, and beside it the
// selected player's panel, where the reader makes his pick while he is on the clock.

/** Where the reader's pick stands in the draft. */
function yourTurn(draft: DraftState, board: DraftBoard, onTheClock: OnTheClock | null): YourTurn {
  if (draft.status !== "live" || onTheClock === null) return { kind: "notStarted" };
  if (draft.clock?.pausedAt !== undefined) return { kind: "paused" };
  if (board.yourTeamId === null || draft.onTheClock.teamId !== board.yourTeamId) return { kind: "notYours" };
  return { kind: "yours", slot: slotWords(draft.onTheClock.round, pickInRoundOf(draft.onTheClock.pick, draft.order.length)), onTheClock };
}

export function PickRoom({
  leagueId,
  seam,
  draft,
  board,
  onTheClock,
}: {
  leagueId: Id<"leagues">;
  seam: DraftSeam;
  draft: DraftState;
  board: DraftBoard;
  onTheClock: OnTheClock | null;
}) {
  const greyed = seam.useGreyedOut(leagueId);
  const changes = seam.useDraftChanges();
  const [selected, setSelected] = useState<ListedPlayer | null>(null);
  const whyNot: WhyNot = useMemo(() => new Map((greyed ?? []).map(({ code, reason }) => [code, reason])), [greyed]);
  return (
    <div className="flex flex-wrap items-start gap-2">
      <DraftPlayers leagueId={leagueId} usePlayersList={seam.usePlayersList} whyNot={whyNot} selected={selected} select={setSelected} />
      <div className="flex min-w-0 grow basis-widgets flex-col gap-2 lg:grow-0">
        {selected !== null && (
          <PickPanel
            key={selected.code}
            leagueId={leagueId}
            player={selected}
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
