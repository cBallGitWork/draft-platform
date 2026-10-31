// A box left without a number hands up NaN (NumberBox.tsx), at any depth of a rules draft. The
// server never holds one, so a draft with one in it is never the saved part, though JSON writes
// NaN as null (#623); and it is refused before it is sent, the refusal said beside the box and
// the cursor put in it (#645).

import { createContext, useEffect, useLayoutEffect, useRef, useState } from "react";

/** Whether `value`, or anything inside it, is a box left without a number. */
export function holdsBlank(value: unknown): boolean {
  if (typeof value === "number") return Number.isNaN(value);
  if (value !== null && typeof value === "object") return Object.values(value).some(holdsBlank);
  return false;
}

/** A box left without a number, as NumberBox.tsx marks it. */
const BLANK_BOX = 'input[aria-invalid="true"]';

/** A save's refusal said beside the box it names: that box's id, and the words. */
export type BoxRefusal = { boxId: string; words: string };

/** The refusal a rules screen says beside a box, if any: NumberBox.tsx shows it under the box
 *  whose id it names. */
export const BoxRefusalContext = createContext<BoxRefusal | null>(null);

/** Once `refused` is called, and the screen has drawn what changed with it, finds the first blank
 *  box inside `area` (the one a screen's refusal names, as each checks its boxes in the order it
 *  shows them) as `box`, before the screen is painted, so the refusal is never seen elsewhere
 *  first; then, with the refusal drawn beside it, puts the cursor in it. `box` is null until a
 *  refusal finds one. */
export function useBlankBox() {
  const area = useRef<HTMLDivElement>(null);
  const [refusals, setRefusals] = useState(0);
  // A new object at each refusal, so a box refused again takes the cursor again.
  const [found, setFound] = useState<{ box: HTMLElement | null }>({ box: null });
  useLayoutEffect(() => {
    if (refusals > 0) setFound({ box: area.current?.querySelector<HTMLElement>(BLANK_BOX) ?? null });
  }, [refusals]);
  useEffect(() => found.box?.focus(), [found]);
  return { area, box: found.box, refused: () => setRefusals((count) => count + 1) };
}
