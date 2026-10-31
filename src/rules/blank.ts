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

/** A save's refusal said beside the box it names: that box's id, the words, and `gone`, for the
 *  box to call if it leaves the screen while saying them, so the bar says them instead. */
export type BoxRefusal = { boxId: string; words: string; gone: () => void };

/** The refusal a rules screen says beside a box, if any: NumberBox.tsx shows it under the box
 *  whose id it names. */
export const BoxRefusalContext = createContext<BoxRefusal | null>(null);

/** After `refused`, once the screen has drawn what changed with it: `box` is the first blank box
 *  inside `area`, the one the refusal names (each screen checks its boxes in the order it shows
 *  them), found before paint so the refusal never shows in the bar first; then the cursor goes
 *  into it. Null until a refusal finds one, or once that box is `gone` (a box found since stays). */
export function useBlankBox() {
  const area = useRef<HTMLDivElement>(null);
  const [refusals, setRefusals] = useState(0);
  // A new object at each refusal, so a box refused again takes the cursor again.
  const [found, setFound] = useState<{ box: HTMLElement | null }>({ box: null });
  useLayoutEffect(() => {
    if (refusals > 0) setFound({ box: area.current?.querySelector<HTMLElement>(BLANK_BOX) ?? null });
  }, [refusals]);
  useEffect(() => found.box?.focus(), [found]);
  return { area, box: found.box, refused: () => setRefusals((count) => count + 1), gone: (box: HTMLElement) => setFound((now) => (now.box === box ? { box: null } : now)) };
}
