// What the Tactics tab marks its controls with, so it can put the focus back where a manager was
// after a move (TacticsPage.tsx): the mark on a control and the selector that finds it, in one
// place, so renaming one can't quietly break the other.

/** Move on a player (on the pitch or the bench), his role picker, and a bench player's Up and Down. */
export type FocusMark = "player" | "role" | "bench-up" | "bench-down";

/** The attribute that marks a control as `mark` for this player, to spread onto it. */
export const markOf = (mark: FocusMark, playerCode: number) => ({ [`data-${mark}`]: playerCode });

/** The selector that finds the control marked `mark` for this player. */
export const markedBy = (mark: FocusMark, playerCode: number) => `[data-${mark}="${playerCode}"]`;
