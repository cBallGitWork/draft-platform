import { type ReactNode, useMemo, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type { ListedPlayer } from "../scouting/seam";
import { AutoPickPanel } from "./AutoPickPanel";
import { pickInRoundOf } from "./board";
import type { OnTheClock, UndoWindow } from "./ClockLeft";
import { DraftPlayers, type WhyNot } from "./DraftPlayers";
import { PickPanel, type YourSquad, type YourTurn } from "./PickPanel";
import { QueuePanel } from "./QueuePanel";
import type { DraftBoard, DraftSeam, DraftState } from "./seam";
import { slotWords } from "./words";

// Under the board (the approved draft room picture; #1099): the players list, and beside it the
// right-hand column, the selected player's panel on top, where the reader makes his pick while he
// is on the clock, then his queue, do-not-draft list and auto-pick until the draft is over (#1100).
// The column keeps its width with no player selected, so the list doesn't move; the commissioner's
// panel, passed in as `children`, sits at its foot (#1101), its Pick for taking the selected player
// for the team on the clock (#1475).

/** Where the reader's pick stands in the draft. */
function yourTurn(draft: DraftState, board: DraftBoard, onTheClock: OnTheClock | null): YourTurn {
  if (draft.status === "ending") return { kind: "allPicked" };
  if (draft.status !== "live" || onTheClock === null) return { kind: "notStarted" };
  if (draft.clock?.pausedAt !== undefined) return { kind: "paused" };
  if (board.yourTeamId === null || draft.onTheClock.teamId !== board.yourTeamId) return { kind: "notYours" };
  return { kind: "yours", slot: slotWords(draft.onTheClock.round, pickInRoundOf(draft.onTheClock.pick, draft.order.length)), onTheClock };
}

/** The 10 seconds the reader has to undo the last pick, made by him himself (#1458): until the
 *  next clock starts or, after the last pick, the draft ends; null for no such pick. */
function yourUndo(draft: DraftState, board: DraftBoard): UndoWindow | null {
  if (board.yourTeamId === null || (draft.status !== "live" && draft.status !== "ending") || draft.ownPickBy !== board.yourTeamId) return null;
  if (draft.status === "ending") return { until: draft.endsAt, pausedAt: draft.pausedAt };
  return draft.clock === null ? null : { until: draft.clock.startsAt, pausedAt: draft.clock.pausedAt };
}

/** How many players of `player`'s main position and of his club the reader's picks so far hold. */
function yourSquad(board: DraftBoard, player: ListedPlayer): YourSquad {
  if (board.yourTeamId === null) return null;
  const yours = board.picks.flatMap(({ teamId, player: picked }) => (teamId === board.yourTeamId && picked !== null ? [picked] : []));
  return {
    atPosition: yours.filter(({ position }) => position === player.positions[0]).length,
    atClub: yours.filter(({ clubShortName }) => clubShortName === player.club.shortName).length,
    maxPerClub: board.maxPerClub,
  };
}

export function PickRoom({
  leagueId,
  seam,
  draft,
  board,
  onTheClock,
  children,
}: {
  leagueId: Id<"leagues">;
  seam: DraftSeam;
  draft: DraftState;
  board: DraftBoard;
  onTheClock: OnTheClock | null;
  /** The column's foot: the commissioner's panel, for whoever runs the league, given the selected
   *  player, whom his Pick for takes, and how to let him go once picked. */
  children?: (selected: ListedPlayer | null, unselect: () => void) => ReactNode;
}) {
  const greyed = seam.useGreyedOut(leagueId);
  const figures = seam.useFigures(leagueId);
  const lists = seam.useLists(leagueId);
  const changes = seam.useDraftChanges();
  const listChanges = seam.useListChanges();
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
            squad={yourSquad(board, selected)}
            whyNot={whyNot.get(selected.code)}
            turn={yourTurn(draft, board, onTheClock)}
            undo={yourUndo(draft, board)}
            changes={changes}
            lists={draft.status === "over" ? null : lists}
            listChanges={listChanges}
            close={() => setSelected(null)}
          />
        )}
        {draft.status !== "over" && (
          <>
            <QueuePanel leagueId={leagueId} seam={seam} />
            <AutoPickPanel leagueId={leagueId} board={board} teams={draft.order.length} seam={seam} />
          </>
        )}
        {children?.(selected, () => setSelected(null))}
      </div>
    </div>
  );
}
