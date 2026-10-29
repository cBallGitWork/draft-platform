import { useState } from "react";

/** A choice kept to one still on offer as the options change: the one chosen while it is among
 *  them, else the first; undefined when nothing is on offer. Nothing chosen yet counts as the first. */
export function useChoiceAmong<T>(options: readonly T[], initial?: T): [T | undefined, (choice: T) => void] {
  const [chosen, choose] = useState<T | undefined>(initial);
  const shown = chosen !== undefined && options.includes(chosen) ? chosen : options[0];
  return [shown, choose];
}
