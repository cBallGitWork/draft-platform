// What a screen reader hears after a box's name: the words of the elements its aria-describedby
// names, in order. The repo has no jest-dom, so this stands in for toHaveAccessibleDescription.

export function descriptionOf(box: HTMLElement): string {
  return describerIds(box).map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
}

/** The refusal said beside `box` (src/rules/NumberBox.tsx, #645): the alert drawn straight after
 *  it, when the box is described by it too (a hint may describe it as well); else null. */
export function refusalBeside(box: HTMLElement): string | null {
  const next = box.nextElementSibling;
  if (next?.getAttribute("role") !== "alert") return null;
  return describerIds(box).includes(next.id) ? next.textContent : null;
}

const describerIds = (box: HTMLElement) => box.getAttribute("aria-describedby")?.split(" ") ?? [];
