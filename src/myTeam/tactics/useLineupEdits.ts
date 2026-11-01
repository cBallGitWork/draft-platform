import { useMemo, useRef, useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { useChange } from "../../shared/useChange";
import { sameLineup, shownLineup, type DraftLineup } from "./lineupDraft";
import type { LineupChanges } from "./seam";

/** The lineup the Tactics tab shows and each move to it (spec/05, Moving players): every move saves
 *  itself, with the server's refusal kept in its words; Undo goes back through every move since the
 *  tab was opened, a save not clearing it ("save doesn't mean we leave the page"). `onShown` runs
 *  each time another lineup shows, so the page can put down the player in hand. */
export function useLineupEdits({
  leagueId,
  opening,
  squadCodes,
  changes,
  onShown,
}: {
  leagueId: Id<"leagues">;
  opening: DraftLineup;
  squadCodes: readonly number[];
  changes: LineupChanges;
  onShown(): void;
}) {
  // The manager's last move; it stays after it is saved, so the pitch never shows the lineup held
  // before the server catches up with it.
  const [edited, setEdited] = useState<DraftLineup | null>(null);
  // Each lineup a move left behind, newest last, since the tab was opened: what Undo goes back to.
  const [undoable, setUndoable] = useState<readonly DraftLineup[]>([]);
  // The preset last picked, whose empty slots the pitch marks; none until one is.
  const [shape, setShape] = useState<string>("");
  const [savedFrom, setSavedFrom] = useState<number | null>(null);
  // The lineup the save last sent. A save sent after it forgets it, so the answer that lands after
  // one, about a lineup no longer on the pitch, says nothing (#642).
  const sent = useRef<DraftLineup | null>(null);
  const { problem, run, clear } = useChange();
  const draft = useMemo(() => shownLineup(edited, opening, squadCodes), [edited, opening, squadCodes]);

  // The gameweek is the server's: a save sent just after the deadline is from the one after. A
  // lineup that can't stand yet, ten starting say, is refused in the server's words and kept.
  const save = async (lineup: DraftLineup) => {
    sent.current = lineup;
    const movedSince = () => sent.current !== lineup;
    let from: number | null = null;
    const made = await run(async () => {
      const answer = await changes.save(leagueId, lineup);
      // run says a refusal itself, so one of a lineup moved since is withheld here; a save, below.
      if (typeof answer === "string") return movedSince() ? null : answer;
      from = answer;
      return null;
    });
    if (movedSince()) return;
    // A refusal leaves no saved line; a save says its gameweek.
    setSavedFrom(made ? from : null);
    // Saved, the lineup stands as it is: the shape's slots are no longer asked for.
    if (made) setShape("");
  };
  /** The lineup shown from now on, saved as it is: the saved line or refusal of the one before no
   *  longer stands, so both go (#622). */
  const show = (next: DraftLineup) => {
    setEdited(next);
    onShown();
    setSavedFrom(null);
    clear();
    void save(next);
  };
  /** Any move that changes the lineup, which Undo can take back. */
  const edit = (next: DraftLineup) => {
    if (sameLineup(next, draft)) return;
    setUndoable((before) => [...before, draft]);
    show(next);
  };
  const undo = () => {
    const last = undoable.at(-1);
    if (last === undefined) return;
    setUndoable(undoable.slice(0, -1));
    setShape("");
    show(last);
  };
  /** The lineup reshaped to a preset, whose empty slots the pitch marks until it saves. */
  const reshape = (name: string, next: DraftLineup) => {
    setShape(name);
    edit(next);
  };
  return { draft, edit, undo, reshape, canUndo: undoable.length > 0, savedFrom, problem, shape };
}
