import { useState } from "react";

/** A change asked of a seam from a screen: whether one is under way, and why the last was refused. */
export function useChange() {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /** Makes the change, and resolves with whether it was made. */
  async function run(change: () => Promise<string | null>): Promise<boolean> {
    setBusy(true);
    const refused = await change();
    setBusy(false);
    setProblem(refused);
    return refused === null;
  }
  return { busy, problem, run };
}
