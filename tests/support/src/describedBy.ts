// What a screen reader hears after a box's name: the words of the elements its aria-describedby
// names, in order. The repo has no jest-dom, so this stands in for toHaveAccessibleDescription.

export function descriptionOf(box: HTMLElement): string {
  const ids = box.getAttribute("aria-describedby")?.split(" ") ?? [];
  return ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
}

/** The refusal said beside `box` (src/rules/NumberBox.tsx, #645): the alert drawn straight after
 *  it, when the box is described by it too; else null. */
export function refusalBeside(box: HTMLElement): string | null {
  const next = box.nextElementSibling;
  if (next?.getAttribute("role") !== "alert") return null;
  return descriptionOf(box) === next.textContent ? next.textContent : null;
}
