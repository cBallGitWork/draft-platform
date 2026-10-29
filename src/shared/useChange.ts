import { useState } from "react";
import { answerOf, type Change } from "./refusal";
import { changeFailedWords } from "./words";

/** A change asked of a seam from a screen: whether one is under way, and why the last was refused. */
export function useChange() {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /** Makes the change, and resolves with whether it was made. A change that throws, though a
   *  Change shouldn't (refusal.ts), is logged and said as a failure, never left busy (#253). */
  async function run(change: () => Change): Promise<boolean> {
    setBusy(true);
    const refused = await answerOf(change, "A change", changeFailedWords);
    setBusy(false);
    setProblem(refused);
    return refused === null;
  }
  /** Forgets the last refusal, as when the screen it was said on is opened afresh. */
  const clear = () => setProblem(null);
  return { busy, problem, run, clear };
}

/** What `useChange` hands a screen, to pass down to the parts that make changes. */
export type Changing = ReturnType<typeof useChange>;
