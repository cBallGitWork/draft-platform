// A box left without a number hands up NaN (NumberBox.tsx), at any depth of a rules draft. The
// server never holds one, so a draft with one in it is never the saved part, though JSON writes
// NaN as null (#623); and it is refused before it is sent.

import { useEffect, useRef, useState } from "react";

/** Whether `value`, or anything inside it, is a box left without a number. */
export function holdsBlank(value: unknown): boolean {
  if (typeof value === "number") return Number.isNaN(value);
  if (value !== null && typeof value === "object") return Object.values(value).some(holdsBlank);
  return false;
}

/** A box left without a number, as NumberBox.tsx marks it. */
const BLANK_BOX = 'input[aria-invalid="true"]';

/** Once `refused` is called, and the screen has drawn what changed with it, puts the cursor in the
 *  first blank box inside `area`: the one a screen's refusal names, as each checks its boxes in
 *  the order it shows them (#645). */
export function useBlankFocus<Area extends HTMLElement>() {
  const area = useRef<Area>(null);
  const [refusals, setRefusals] = useState(0);
  useEffect(() => {
    if (refusals > 0) area.current?.querySelector<HTMLElement>(BLANK_BOX)?.focus();
  }, [refusals]);
  return { area, refused: () => setRefusals((count) => count + 1) };
}
