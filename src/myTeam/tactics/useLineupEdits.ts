import { useMemo, useRef, useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { useChange } from "../../shared/useChange";
import { sameLineup, shownLineup, type EditedLineup } from "./lineupEdits";
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
  opening: EditedLineup;
  squadCodes: readonly number[];
  changes: LineupChanges;
  onShown(): void;
}) {
  // The manager's last move; it stays after it is saved, so the pitch never shows the lineup held
  // before the server catches up with it.
  const [edited, setEdited] = useState<EditedLineup | null>(null);
  // Each lineup a move left behind, newest last, since the tab was opened: what Undo goes back to.
  const [undoable, setUndoable] = useState<readonly EditedLineup[]>([]);
  // The preset last picked, whose empty slots the pitch marks; none until one is.
  const [shape, setShape] = useState<string>("");
  // When the last save landed, by the manager's own clock: the line under the toolbar says it.
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // The lineup the save last sent. A save sent after it forgets it, so the answer that lands after
  // one, about a lineup no longer on the pitch, says nothing (#642).
  const sent = useRef<EditedLineup | null>(null);
  const { problem, run, clear } = useChange();
  // Why the last drop was refused, said where a save's line is (spec/05; Craig, 4 Nov 2026), until
  // the next move.
  const [refused, setRefused] = useState<string | null>(null);
  // Which instruction the last preset picked switched, said under the toolbar (spec/05, Team
  // instructions: "Park the bus needs 5 at the back: switched to Keep it tight early"), until the
  // next move.
  const [switchedNote, setSwitchedNote] = useState<string | null>(null);
  const draft = useMemo(() => shownLineup(edited, opening, squadCodes), [edited, opening, squadCodes]);

  // A lineup that can't stand yet, ten starting say, is refused in the server's words and kept.
  const save = async (lineup: EditedLineup) => {
    sent.current = lineup;
    const movedSince = () => sent.current !== lineup;
    const made = await run(async () => {
      const answer = await changes.save(leagueId, lineup);
      // run says a refusal itself, so one of a lineup moved since is withheld here; a save, below.
      return typeof answer === "string" && !movedSince() ? answer : null;
    });
    if (movedSince()) return;
    // A refusal leaves no saved line; a save says when it landed ("Line-up saved 14:02"; spec/05).
    setSavedAt(made ? Date.now() : null);
    // Saved, the lineup stands as it is: the shape's slots are no longer asked for.
    if (made) setShape("");
  };
  /** The lineup shown from now on, saved as the pitch shows it, read against the squad as it is now,
   *  so an Undo back past a squad change never sends a player the squad no longer holds (#1562):
   *  the saved line or refusal of the one before no longer stands, so both go (#622). */
  const show = (next: EditedLineup) => {
    const shown = shownLineup(next, opening, squadCodes);
    setEdited(shown);
    onShown();
    setSavedAt(null);
    setRefused(null);
    setSwitchedNote(null);
    clear();
    void save(shown);
  };
  /** A drop refused, in words: the lineup stays as it is, and the line under the toolbar says why. */
  const refuse = (words: string) => {
    onShown();
    setSavedAt(null);
    clear();
    setRefused(words);
  };
  /** Any move that changes the lineup, which Undo can take back. */
  const edit = (next: EditedLineup) => {
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
  /** The lineup reshaped to a preset, whose empty slots the pitch marks until it saves, with the
   *  words for any instruction it switched; `said`, a line under the toolbar about it, such as a
   *  loaded plan's roles no longer allowed (#992). */
  const reshape = (name: string, next: EditedLineup, switched: string | null, said: string | null = null) => {
    setShape(name);
    edit(next);
    setSwitchedNote(switched);
    setRefused(said);
  };
  return { draft, edit, undo, reshape, refuse, canUndo: undoable.length > 0, savedAt, switchedNote, problem: refused ?? problem, shape };
}
